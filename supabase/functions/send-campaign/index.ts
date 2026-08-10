import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const D1_WORKER_ENDPOINT = (Deno.env.get("D1_WORKER_ENDPOINT") ?? "").replace(/\/+$/, "");
const D1_WORKER_AUTH_TOKEN = Deno.env.get("D1_WORKER_AUTH_TOKEN") ?? "";
interface RecipientContact { email:string; full_name:string|null; username:string|null; country:string|null; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: adminProfile } = await supabase.from("admin_profiles").select("id").eq("user_id", userData.user.id).maybeSingle();
    if (!adminProfile) return jsonResponse({ error: "Unauthorized" }, 401);

    const { campaignId, contactCount } = await req.json();
    if (!campaignId) return jsonResponse({ error: "campaignId is required" }, 400);
    const { data: campaign, error: cErr } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
    if (cErr || !campaign) return jsonResponse({ error: "Campaign not found" }, 404);
    const EMAIL_REGEX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!campaign.sender_email || !EMAIL_REGEX.test(campaign.sender_email.trim())) return jsonResponse({ error: "Campaign sender_email is missing or invalid." }, 400);
    const fromAddress = campaign.sender_name?.trim() ? `${campaign.sender_name.trim()} <${campaign.sender_email.trim()}>` : campaign.sender_email.trim();

    let allContacts: RecipientContact[];
    if (campaign.audience_type === "d1_contacts") {
      const requested = Number(contactCount) > 0 ? Math.floor(Number(contactCount)) : (Number(campaign.d1_contact_count) > 0 ? Number(campaign.d1_contact_count) : null);
      allContacts = await fetchD1Contacts(requested);
    } else {
      const { data: recipients, error: rErr } = await supabase.from("recipients").select("email, full_name, username, country").eq("status", "active");
      if (rErr) throw new Error(rErr.message);
      allContacts = (recipients || []) as RecipientContact[];
    }
    if (!allContacts.length) return jsonResponse({ error: "No contacts available" }, 400);

    const { data: suppressed } = await supabase.from("suppression_list").select("email");
    const suppressedSet = new Set((suppressed || []).map((s:{email:string}) => s.email.toLowerCase()));
    const eligible = allContacts.filter(c => c.email && !suppressedSet.has(c.email.toLowerCase()));
    const suppressedCount = allContacts.length - eligible.length;
    await supabase.from("campaigns").update({ status:"sending", started_at:new Date().toISOString(), total_recipients:eligible.length, suppressed_count:suppressedCount }).eq("id",campaignId);

    const batchSize=Math.max(1,Math.min(Number(campaign.batch_size)||100,500)); let sentCount=0,failedCount=0;
    for(let i=0;i<eligible.length;i+=batchSize){
      const batch=eligible.slice(i,i+batchSize);
      const {data:inserted,error:iErr}=await supabase.from("campaign_recipients").insert(batch.map(c=>({campaign_id:campaignId,email:c.email,status:"pending"}))).select("id,email");
      if(iErr) throw iErr; if(!inserted) continue;
      const map=new Map(batch.map(c=>[c.email.toLowerCase(),c]));
      for(const recipient of inserted){
        try{
          const c=map.get(recipient.email.toLowerCase()); let html=campaign.html_content; const personalization:Record<string,string>={};
          if(c?.full_name){personalization.FullName=c.full_name;html=html.replaceAll("[[FullName]]",c.full_name)}
          if(c?.username){personalization.Username=c.username;html=html.replaceAll("[[Username]]",c.username)}
          if(c?.country){personalization.Country=c.country;html=html.replaceAll("[[Country]]",c.country)}
          if(c?.email){personalization.Email=c.email;html=html.replaceAll("[[Email]]",c.email)}
          const r=await sendViaResend({to:recipient.email,subject:campaign.subject,html,from:fromAddress,replyTo:campaign.reply_to_email||undefined});
          if(r.success){await supabase.from("campaign_recipients").update({status:"sent",provider_message_id:r.messageId,sent_at:new Date().toISOString(),personalization}).eq("id",recipient.id);await supabase.from("email_activity").insert({recipient_email:recipient.email,campaign_name:campaign.name,email_type:"broadcast",status:"sent",provider_message_id:r.messageId,sent_at:new Date().toISOString()});sentCount++;}
          else{await supabase.from("campaign_recipients").update({status:"failed",error_info:r.error}).eq("id",recipient.id);await supabase.from("email_activity").insert({recipient_email:recipient.email,campaign_name:campaign.name,email_type:"broadcast",status:"failed",error_info:r.error});await supabase.from("failure_reports").insert({recipient_email:recipient.email,failure_type:"failed",reason:r.error||"Send failed",campaign_id:campaignId,campaign_name:campaign.name,provider_response:r.error||""});failedCount++;}
        }catch(err){await supabase.from("campaign_recipients").update({status:"failed",error_info:err instanceof Error?err.message:"Unknown error"}).eq("id",recipient.id);failedCount++;}
      }
      await supabase.from("campaigns").update({sent_count:sentCount,failed_count:failedCount}).eq("id",campaignId);
    }
    await supabase.from("campaigns").update({status:"completed",completed_at:new Date().toISOString(),sent_count:sentCount,failed_count:failedCount}).eq("id",campaignId);
    return jsonResponse({success:true,sent:sentCount,failed:failedCount,total:eligible.length,suppressed:suppressedCount});
  } catch (err) { return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500); }
});

async function fetchD1Contacts(count:number|null):Promise<RecipientContact[]>{
  if(!D1_WORKER_ENDPOINT||!D1_WORKER_AUTH_TOKEN) throw new Error("D1_WORKER_ENDPOINT and D1_WORKER_AUTH_TOKEN must be configured as edge function secrets.");
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),60000);
  try{const response=await fetch(`${D1_WORKER_ENDPOINT}/contacts/retrieve`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${D1_WORKER_AUTH_TOKEN}`},body:JSON.stringify({count:count||50000}),signal:controller.signal});if(!response.ok)throw new Error(`Worker returned HTTP ${response.status}: ${await response.text().catch(()=>"")}`);const json=await response.json();return (json.contacts||[]) as RecipientContact[]}finally{clearTimeout(timeout)}
}
async function sendViaResend(params:{to:string;subject:string;html:string;from:string;replyTo?:string}):Promise<{success:boolean;messageId?:string;error?:string}>{
  if(!RESEND_API_KEY)return{success:false,error:"RESEND_API_KEY not configured"};
  try{const body:Record<string,string>={to:params.to,subject:params.subject,html:params.html,from:params.from};if(params.replyTo)body.reply_to=params.replyTo;const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${RESEND_API_KEY}`},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)return{success:false,error:data.message||`Resend API error: ${response.status}`};return{success:true,messageId:data.id}}catch(err){return{success:false,error:err instanceof Error?err.message:"Resend API error"}}
}
function jsonResponse(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
