import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
const RESEND_API_KEY=Deno.env.get("RESEND_API_KEY")??"";
const DEFAULT_FROM_EMAIL=Deno.env.get("DEFAULT_FROM_EMAIL")??"";
const EMAIL_REGEX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const buildFromAddress=(name:string|undefined,email:string)=>name?.trim()?`${name.trim()} <${email.trim()}>`:email.trim();

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
  try{
    const authHeader=req.headers.get("Authorization")??"";
    if(!authHeader.startsWith("Bearer "))return jsonResponse({error:"Unauthorized"},401);
    const supabase=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
    const {data:userData,error:authError}=await supabase.auth.getUser(authHeader.slice(7));
    if(authError||!userData.user)return jsonResponse({error:"Unauthorized"},401);
    const {data:adminProfile}=await supabase.from("admin_profiles").select("id").eq("user_id",userData.user.id).maybeSingle();
    if(!adminProfile)return jsonResponse({error:"Unauthorized"},401);

    const {to,subject,html,senderName,senderEmail,testRecordId}=await req.json();
    if(!to||!subject||!html)return jsonResponse({error:"to, subject, and html are required"},400);
    if(!EMAIL_REGEX.test(String(to).trim()))return jsonResponse({error:"Invalid recipient email"},400);
    if(!RESEND_API_KEY)return jsonResponse({error:"RESEND_API_KEY is not configured."},500);

    let fromAddress="";
    if(senderEmail){
      if(!EMAIL_REGEX.test(String(senderEmail).trim()))return jsonResponse({error:"Invalid sender email"},400);
      fromAddress=buildFromAddress(senderName,senderEmail);
    }else{
      fromAddress=DEFAULT_FROM_EMAIL.trim();
    }
    if(!fromAddress)return jsonResponse({error:"No sender configured. Set DEFAULT_FROM_EMAIL or provide senderEmail."},500);

    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({to,subject,html,from:fromAddress})});
    const data=await response.json();
    if(!response.ok){
      const message=data.message??data.error??"Resend rejected the request";
      if(testRecordId)await supabase.from("test_email_records").update({status:"failed",error_info:message}).eq("id",testRecordId);
      return jsonResponse({error:message},response.status);
    }
    if(testRecordId)await supabase.from("test_email_records").update({status:"sent",result:`Sent successfully. Message ID: ${data.id}`}).eq("id",testRecordId);
    return jsonResponse({success:true,messageId:data.id,recordId:testRecordId??null});
  }catch(err){
    return jsonResponse({error:err instanceof Error?err.message:"Internal server error"},500);
  }
});
