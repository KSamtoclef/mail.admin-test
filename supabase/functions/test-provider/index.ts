import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";

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
    const auth = await requireAdmin(req);
    if (!auth.ok) return withCors(auth.response);

    if (!RESEND_API_KEY) {
      return jsonResponse({
        success: false,
        error: "RESEND_API_KEY not configured. Set it as an edge function secret in your Supabase project settings.",
      }, 200);
    }

    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (response.ok) {
      return jsonResponse({ success: true, message: "Resend API key is valid" });
    }

    const data = await response.json();
    return jsonResponse({
      success: false,
      error: data.message || `Resend API returned ${response.status}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    return jsonResponse({ success: false, error: message });
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}
