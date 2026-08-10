import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
    const svixSignature = req.headers.get("svix-signature") ?? "";
    if (!WEBHOOK_SECRET) return jsonResponse({ error: "Webhook secret not configured" }, 500);
    if (!svixId || !svixTimestamp || !svixSignature) return jsonResponse({ error: "Missing svix headers" }, 401);
    const rawBody = await req.text();
    if (!await verifySvixSignature(WEBHOOK_SECRET, svixId, svixTimestamp, svixSignature, rawBody)) return jsonResponse({ error: "Invalid webhook signature" }, 401);
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(svixTimestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return jsonResponse({ error: "Webhook timestamp out of range" }, 401);

    const event = JSON.parse(rawBody);
    const eventType: string = event.type ?? "";
    const emailId: string = event.data?.email_id ?? "";
    const recipientEmail: string = event.data?.to?.[0] ?? event.data?.to ?? "";
    const subject: string = event.data?.subject ?? "";
    const eventCreatedAt: string = event.data?.created_at ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: existing } = await supabase.from("resend_events").select("id").eq("svix_id", svixId).maybeSingle();
    if (existing) return jsonResponse({ ok: true, deduplicated: true });
    await supabase.from("resend_events").insert({ svix_id: svixId, event_type: eventType, email_id: emailId, recipient_email: recipientEmail || null, subject: subject || null, event_created_at: eventCreatedAt || null, raw_payload: event });

    if (emailId) {
      const { data: recipient } = await supabase.from("campaign_recipients").select("id, campaign_id, email").eq("provider_message_id", emailId).maybeSingle();
      if (recipient) {
        const nowIso = new Date().toISOString();
        const updates: Record<string, string> = {};
        switch (eventType) {
          case "email.delivered": updates.delivered_at = nowIso; updates.status = "delivered"; break;
          case "email.opened": updates.opened_at = nowIso; break;
          case "email.clicked": updates.clicked_at = nowIso; break;
          case "email.bounced": updates.bounced_at = nowIso; updates.status = "bounced"; break;
          case "email.complained": updates.complained_at = nowIso; updates.status = "complained"; break;
        }
        if (Object.keys(updates).length) await supabase.from("campaign_recipients").update(updates).eq("id", recipient.id);
        await supabase.from("delivery_events").insert({ campaign_recipient_id: recipient.id, event_type: eventType, provider_message_id: emailId, raw_data: event });

        if (recipient.campaign_id) {
          const { data: campaign } = await supabase.from("campaigns").select("delivered_count, opened_count, clicked_count, bounced_count, complained_count").eq("id", recipient.campaign_id).maybeSingle();
          if (campaign) {
            const campaignUpdates: Record<string, number> = {};
            if (eventType === "email.delivered") campaignUpdates.delivered_count = (campaign.delivered_count || 0) + 1;
            if (eventType === "email.opened") campaignUpdates.opened_count = (campaign.opened_count || 0) + 1;
            if (eventType === "email.clicked") campaignUpdates.clicked_count = (campaign.clicked_count || 0) + 1;
            if (eventType === "email.bounced") campaignUpdates.bounced_count = (campaign.bounced_count || 0) + 1;
            if (eventType === "email.complained") campaignUpdates.complained_count = (campaign.complained_count || 0) + 1;
            if (Object.keys(campaignUpdates).length) await supabase.from("campaigns").update(campaignUpdates).eq("id", recipient.campaign_id);
          }
        }

        if (eventType === "email.bounced" || eventType === "email.complained") {
          const reason = eventType === "email.bounced" ? "hard_bounce" : "spam_complaint";
          await supabase.from("suppression_list").upsert({ email: String(recipient.email).trim().toLowerCase(), reason, source: "webhook" }, { onConflict: "email" });
          await supabase.from("failure_reports").insert({ recipient_email: recipient.email, failure_type: reason, reason: eventType === "email.bounced" ? (event.data?.bounce?.message || "Email bounced") : "Spam complaint received", campaign_id: recipient.campaign_id });
        }
      }
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});

async function verifySvixSignature(secret: string, svixId: string, svixTimestamp: string, svixSignature: string, rawBody: string): Promise<boolean> {
  try {
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const secretBytes = base64ToBytes(secretKey);
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expectedSig = "v1," + bytesToBase64(new Uint8Array(signature));
    return svixSignature.split(" ").includes(expectedSig);
  } catch { return false; }
}
function base64ToBytes(b64: string): Uint8Array { const binary = atob(b64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes; }
function bytesToBase64(bytes: Uint8Array): string { let binary = ""; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary); }
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
