import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DEFAULT_FROM_EMAIL = Deno.env.get("DEFAULT_FROM_EMAIL") ?? "";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmailAddress(value: string): string | null {
  if (!value || !value.trim()) return null;
  const match = value.match(/<([^>]+)>/);
  return match ? match[1] : value.trim();
}

function isValidFromFormat(value: string): boolean {
  if (!value || !value.trim()) return false;
  if (value.includes("<") && value.includes(">")) {
    const match = value.match(/^"?(.+?)"?\s*<([^>]+)>$/);
    if (!match) return false;
    return EMAIL_REGEX.test(match[2]);
  }
  return EMAIL_REGEX.test(value);
}

function buildFromAddress(name: string | null, email: string): string {
  const cleanName = (name ?? "").trim();
  const cleanEmail = email.trim();
  return cleanName ? `${cleanName} <${cleanEmail}>` : cleanEmail;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, senderName, senderEmail, testRecordId } = await req.json();

    if (!to || !subject || !html) {
      return jsonResponse({ error: "to, subject, and html are required" }, 400);
    }

    if (!RESEND_API_KEY) {
      return jsonResponse({ error: "RESEND_API_KEY is not configured. Add it as an edge function secret." }, 500);
    }

    // Fetch verified domains from Resend to validate the sender domain
    let verifiedDomains: string[] = [];
    try {
      const domainsResponse = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();
        verifiedDomains = (domainsData.data ?? [])
          .filter((d: { status: string }) => d.status === "verified")
          .map((d: { name: string }) => d.name.toLowerCase());
      }
    } catch {
      // If we can't fetch domains, we'll rely on Resend's own validation
    }

    // Determine the sender address
    let fromAddress: string | null = null;

    if (senderEmail && senderEmail.trim()) {
      if (!EMAIL_REGEX.test(senderEmail.trim())) {
        return jsonResponse(
          { error: `Invalid sender email format: "${senderEmail}". Expected format: email@example.com` },
          400
        );
      }
      const senderDomain = senderEmail.split("@")[1]?.toLowerCase() ?? "";
      if (verifiedDomains.length > 0 && !verifiedDomains.includes(senderDomain)) {
        return jsonResponse(
          { error: `Sender domain "${senderDomain}" is not verified in Resend. Verified domains: ${verifiedDomains.join(", ") || "none"}` },
          400
        );
      }
      fromAddress = buildFromAddress(senderName, senderEmail);
    }

    if (!fromAddress) {
      if (DEFAULT_FROM_EMAIL && DEFAULT_FROM_EMAIL.trim()) {
        if (!isValidFromFormat(DEFAULT_FROM_EMAIL)) {
          return jsonResponse(
            { error: `DEFAULT_FROM_EMAIL secret has invalid format: "${DEFAULT_FROM_EMAIL}". Expected format: email@example.com or Name <email@example.com>` },
            500
          );
        }
        fromAddress = DEFAULT_FROM_EMAIL;
      } else {
        return jsonResponse(
          { error: "No sender configured. Provide a senderEmail or set the DEFAULT_FROM_EMAIL edge function secret." },
          500
        );
      }
    }

    // Final safety check — never send a malformed from field to Resend
    if (!isValidFromFormat(fromAddress)) {
      return jsonResponse(
        { error: `Resolved sender address is malformed: "${fromAddress}". Check DEFAULT_FROM_EMAIL secret and sender input.` },
        500
      );
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ to, subject, html, from: fromAddress }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || data.error || "Resend API rejected the request";
      const errorDetails = data.name ? `${data.name}: ${errorMessage}` : errorMessage;

      if (testRecordId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await supabase
          .from("test_email_records")
          .update({ status: "failed", error_info: errorDetails })
          .eq("id", testRecordId);
      }

      return jsonResponse({ error: errorDetails }, 500);
    }

    if (testRecordId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabase
        .from("test_email_records")
        .update({ status: "sent", result: `Sent successfully. Message ID: ${data.id}` })
        .eq("id", testRecordId);
    }

    return jsonResponse({ success: true, messageId: data.id, recordId: testRecordId });
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
