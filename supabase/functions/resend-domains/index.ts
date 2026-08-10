import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the user is authenticated and is an admin
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!adminProfile) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (!RESEND_API_KEY) {
      return jsonResponse({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "list";

    // GET /resend-domains — list all domains with full records
    if (req.method === "GET" && action === "list") {
      const listResponse = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });

      if (!listResponse.ok) {
        const errData = await listResponse.json();
        return jsonResponse({ error: errData.message || "Failed to fetch domains" }, 500);
      }

      const listData = await listResponse.json();
      const domains = listData.data ?? [];

      // Fetch full details for each domain to get the complete records array
      const detailedDomains = await Promise.all(
        domains.map(async (d: { id: string }) => {
          const detailResponse = await fetch(`https://api.resend.com/domains/${d.id}`, {
            headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          });
          if (!detailResponse.ok) return d;
          return await detailResponse.json();
        })
      );

      return jsonResponse({ domains: detailedDomains });
    }

    // POST /resend-domains?action=verify — verify a domain
    if (req.method === "POST" && action === "verify") {
      const { domainId } = await req.json();
      if (!domainId) {
        return jsonResponse({ error: "domainId is required" }, 400);
      }

      const verifyResponse = await fetch(`https://api.resend.com/domains/${domainId}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        return jsonResponse({ error: verifyData.message || "Failed to verify domain" }, 500);
      }

      return jsonResponse({ domain: verifyData });
    }

    // POST /resend-domains?action=create — create a new domain
    if (req.method === "POST" && action === "create") {
      const { name, region } = await req.json();
      if (!name) {
        return jsonResponse({ error: "Domain name is required" }, 400);
      }

      const createResponse = await fetch("https://api.resend.com/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ name, region: region || "us-east-1" }),
      });

      const createData = await createResponse.json();
      if (!createResponse.ok) {
        return jsonResponse({ error: createData.message || "Failed to create domain" }, 500);
      }

      return jsonResponse({ domain: createData });
    }

    // DELETE /resend-domains?action=delete — delete a domain
    if (req.method === "DELETE" && action === "delete") {
      const { domainId } = await req.json();
      if (!domainId) {
        return jsonResponse({ error: "domainId is required" }, 400);
      }

      const deleteResponse = await fetch(`https://api.resend.com/domains/${domainId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });

      if (!deleteResponse.ok) {
        const errData = await deleteResponse.json();
        return jsonResponse({ error: errData.message || "Failed to delete domain" }, 500);
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Invalid action or method" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
