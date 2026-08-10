import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-Client-Info, Apikey"};
const RESEND_API_KEY=Deno.env.get("RESEND_API_KEY")??"";
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

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
    if(!RESEND_API_KEY)return jsonResponse({success:false,error:"RESEND_API_KEY not configured. Set it as an edge function secret."});
    const response=await fetch("https://api.resend.com/domains",{headers:{Authorization:`Bearer ${RESEND_API_KEY}`}});
    if(response.ok)return jsonResponse({success:true,message:"Resend API key is valid"});
    const data=await response.json();
    return jsonResponse({success:false,error:data.message||`Resend API returned ${response.status}`});
  }catch(err){
    return jsonResponse({success:false,error:err instanceof Error?err.message:"Connection test failed"});
  }
});
