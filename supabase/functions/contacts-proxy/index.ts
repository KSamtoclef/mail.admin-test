import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WORKER_ENDPOINT = (Deno.env.get("D1_WORKER_ENDPOINT") ?? "").replace(/\/+$/, "");
const WORKER_AUTH_TOKEN = Deno.env.get("D1_WORKER_AUTH_TOKEN") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Admin authentication (same pattern as resend-domains) ──────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    // ── Validate Worker configuration ──────────────────────────────
    if (!WORKER_ENDPOINT || !WORKER_AUTH_TOKEN) {
      return jsonResponse(
        { error: "D1 Worker endpoint or auth token not configured. Set D1_WORKER_ENDPOINT and D1_WORKER_AUTH_TOKEN as edge function secrets." },
        500
      );
    }

    // ── Parse the incoming request ─────────────────────────────────
    const body = await req.json();
    const { action } = body;

    // ── count → GET /contacts/count ────────────────────────────────
    if (action === "count") {
      const response = await fetch(`${WORKER_ENDPOINT}/contacts/count`, {
        method: "GET",
        headers: { Authorization: `Bearer ${WORKER_AUTH_TOKEN}` },
      });
      return await relay(response);
    }

    // ── retrieve → POST /contacts/retrieve with JSON { count } ──────
    if (action === "retrieve") {
      const count = Number(body.count);
      if (!Number.isFinite(count) || count < 1) {
        return jsonResponse({ error: "count must be a positive integer" }, 400);
      }
      const response = await fetch(`${WORKER_ENDPOINT}/contacts/retrieve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WORKER_AUTH_TOKEN}`,
        },
        body: JSON.stringify({ count }),
      });
      return await relay(response);
    }

    // ── import → POST /contacts/import as real multipart/form-data ─
    if (action === "import") {
      const { csv } = body;
      if (!csv || typeof csv !== "string") {
        return jsonResponse({ error: "csv content is required" }, 400);
      }

      const formData = new FormData();
      formData.append("file", new Blob([csv], { type: "text/csv" }), "contacts.csv");

      const response = await fetch(`${WORKER_ENDPOINT}/contacts/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WORKER_AUTH_TOKEN}` },
        body: formData,
      });
      return await relay(response);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});

async function relay(response: Response): Promise<Response> {
  const text = await response.text();
  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(text);
  } catch {
    jsonBody = { error: text };
  }
  return jsonResponse(jsonBody, response.status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
