import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DEFAULT_FROM_EMAIL = Deno.env.get("DEFAULT_FROM_EMAIL") ?? "";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidFromFormat(value: string): boolean {
  if (!value || !value.trim()) return false;
  if (value.includes("<") && value.includes(">")) {
    const match = value.match(/^"?(.+?)"?\s*<([^>]+)>$/);
    return !!match && EMAIL_REGEX.test(match[2]);
  }
  return EMAIL_REGEX.test(value);
}

function buildFromAddress(name: string | null, email: string): string {
  const cleanName = (name ?? "").trim();
  const cleanEmail = email.trim();
  return cleanName ? `${cleanName} <${cleanEmail}>` : cleanEmail;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return withCors(auth.response);
    const supabase = auth.supabase;

    const { to, subject, html, senderName, senderEmail, testRecordId } = await req.json();
    if (!to || !subject || !html) return jsonResponse({ error: "to, subject, and html are required" }, 400);
    if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY is not configured. Add it as an edge function secret." }, 500);

    let verifiedDomains: string[] = [];
    try {
      const domainsResponse = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${RESEND_API_KEY}` } });
      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        verifiedDomains = (domainsData.data ?? [])
          .filter((d: { status: string }) => d.status === "verified")
          .map((d: { name: string }) => d.name.toLowerCase());
      }
    } catch {
      // Resend validates again on send.
    }

    let fromAddress: string | null = null;
    if (senderEmail && senderEmail.trim()) {
      if (!EMAIL_REGEX.test(senderEmail.trim())) return jsonResponse({ error: "Invalid sender email format." }, 400);
      const senderDomain = senderEmail.split("@")[1]?.toLowerCase() ?? "";
      if (verifiedDomains.length > 0 && !verifiedDomains.includes(senderDomain)) {
        return jsonResponse({ error: `Sender domain "${senderDomain}" is not verified in Resend.` }, 400);
      }
      fromAddress = buildFromAddress(senderName, senderEmail);
    }

    if (!fromAddress) {
      if (!DEFAULT_FROM_EMAIL || !isValidFromFormat(DEFAULT_FROM_EMAIL)) {
        return jsonResponse({ error: "No valid sender configured. Provide senderEmail or configure DEFAULT_FROM_EMAIL." }, 500);
      }
      fromAddress = DEFAULT_FROM_EMAIL;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ to, subject, html, from: fromAddress }),
    });
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error || "Resend API rejected the request";
      if (testRecordId) await supabase.from("test_email_records").update({ status: "failed", error_info: errorMessage }).eq("id", testRecordId);
      return jsonResponse({ error: errorMessage }, 500);
    }

    if (testRecordId) {
      await supabase.from("test_email_records").update({ status: "sent", result: `Sent successfully. Message ID: ${data.id}` }).eq("id", testRecordId);
    }

    return jsonResponse({ success: true, messageId: data.id, recordId: testRecordId });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}
