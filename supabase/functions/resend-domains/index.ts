import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: adminProfile } = await supabase.from("admin_profiles").select("id").eq("user_id", userData.user.id).maybeSingle();
    if (!adminProfile) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);

    const url = new URL(req.url);
    let requestBody: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try { requestBody = await req.json(); } catch { requestBody = {}; }
    }
    const action = url.searchParams.get("action") ?? String(requestBody.action ?? "list");

    if ((req.method === "GET" || req.method === "POST") && action === "list") {
      const listResponse = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      const listData = await listResponse.json();
      if (!listResponse.ok) return jsonResponse({ error: listData.message || "Failed to fetch domains" }, listResponse.status);
      const domains = listData.data ?? [];
      const detailedDomains = await Promise.all(domains.map(async (d: { id: string }) => {
        const detailResponse = await fetch(`https://api.resend.com/domains/${d.id}`, { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
        if (!detailResponse.ok) return d;
        return await detailResponse.json();
      }));
      return jsonResponse({ domains: detailedDomains });
    }

    if (req.method === "POST" && action === "verify") {
      const domainId = String(requestBody.domainId ?? "");
      if (!domainId) return jsonResponse({ error: "domainId is required" }, 400);
      const verifyResponse = await fetch(`https://api.resend.com/domains/${domainId}/verify`, { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) return jsonResponse({ error: verifyData.message || "Failed to verify domain" }, verifyResponse.status);
      const detailResponse = await fetch(`https://api.resend.com/domains/${domainId}`, { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      const domain = await detailResponse.json();
      return jsonResponse(detailResponse.ok ? { domain } : { error: domain.message || "Failed to fetch domain" }, detailResponse.status);
    }

    if (req.method === "POST" && action === "create") {
      const name = String(requestBody.name ?? "");
      const region = String(requestBody.region ?? "us-east-1");
      if (!name) return jsonResponse({ error: "Domain name is required" }, 400);
      const createResponse = await fetch("https://api.resend.com/domains", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` }, body: JSON.stringify({ name, region }) });
      const domain = await createResponse.json();
      return jsonResponse(createResponse.ok ? { domain } : { error: domain.message || "Failed to create domain" }, createResponse.status);
    }

    if ((req.method === "DELETE" || req.method === "POST") && action === "delete") {
      const domainId = String(requestBody.domainId ?? "");
      if (!domainId) return jsonResponse({ error: "domainId is required" }, 400);
      const deleteResponse = await fetch(`https://api.resend.com/domains/${domainId}`, { method: "DELETE", headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      if (!deleteResponse.ok) {
        const errData = await deleteResponse.json();
        return jsonResponse({ error: errData.message || "Failed to delete domain" }, deleteResponse.status);
      }
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: "Invalid action or method" }, 400);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
