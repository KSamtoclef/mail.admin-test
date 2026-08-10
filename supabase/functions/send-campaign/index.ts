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

interface D1Contact {
  id: number;
  email: string;
  full_name: string | null;
  username: string | null;
  country: string | null;
}

interface RecipientContact {
  email: string;
  full_name: string | null;
  username: string | null;
  country: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { campaignId, contactCount } = await req.json();
    if (!campaignId) {
      return jsonResponse({ error: "campaignId is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    if (cErr || !campaign) {
      return jsonResponse({ error: "Campaign not found" }, 404);
    }

    // Validate sender address before sending anything
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!campaign.sender_email || !EMAIL_REGEX.test(campaign.sender_email.trim())) {
      return jsonResponse(
        { error: `Campaign sender_email is missing or invalid: "${campaign.sender_email}". Update the campaign with a valid sender email address.` },
        400
      );
    }

    const fromAddress = campaign.sender_name?.trim()
      ? `${campaign.sender_name.trim()} <${campaign.sender_email.trim()}>`
      : campaign.sender_email.trim();

    // ── Build the recipient list ─────────────────────────────────
    // For d1_contacts audience, fetch from the Cloudflare D1 Worker.
    // Otherwise fall back to the existing Supabase recipients table.
    let allContacts: RecipientContact[];
    let requestedCount: number | null;

    if (campaign.audience_type === "d1_contacts") {
      requestedCount = contactCount && Number.isFinite(contactCount) && contactCount > 0
        ? Math.floor(contactCount)
        : (campaign.d1_contact_count && campaign.d1_contact_count > 0
          ? campaign.d1_contact_count
          : null);
      allContacts = await fetchD1Contacts(requestedCount);
    } else {
      // Existing Supabase recipients path — leave D1 untouched
      const { data: recipients, error: rErr } = await supabase
        .from("recipients")
        .select("email, full_name, username, country")
        .eq("status", "active");
      if (rErr) throw new Error(rErr.message);
      allContacts = (recipients || []).map((r: Record<string, unknown>) => ({
        email: r.email as string,
        full_name: (r.full_name as string) ?? null,
        username: (r.username as string) ?? null,
        country: (r.country as string) ?? null,
      }));
    }

    if (allContacts.length === 0) {
      return jsonResponse({ error: "No contacts available" }, 400);
    }

    // Fetch suppression list
    const { data: suppressed } = await supabase
      .from("suppression_list")
      .select("email");
    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

    // Filter out suppressed emails
    const eligibleContacts = allContacts.filter(
      (c: RecipientContact) => !suppressedSet.has(c.email.toLowerCase())
    );
    const suppressedCount = allContacts.length - eligibleContacts.length;

    // Update campaign with counts and status
    await supabase
      .from("campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
        total_recipients: eligibleContacts.length,
        suppressed_count: suppressedCount,
      })
      .eq("id", campaignId);

    const batchSize = campaign.batch_size || 100;
    let sentCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < eligibleContacts.length; i += batchSize) {
      const batch = eligibleContacts.slice(i, i + batchSize);

      // Insert batch into campaign_recipients
      const recipientRecords = batch.map((c: RecipientContact) => ({
        campaign_id: campaignId,
        email: c.email,
        status: "pending",
      }));

      const { data: inserted } = await supabase
        .from("campaign_recipients")
        .insert(recipientRecords)
        .select("id, email");

      if (!inserted) continue;

      // Map inserted records back to their contact for personalization
      const contactMap = new Map(batch.map((c: RecipientContact) => [c.email.toLowerCase(), c]));

      // Send each email via Resend
      for (const recipient of inserted) {
        try {
          const contact = contactMap.get(recipient.email.toLowerCase());
          const personalization: Record<string, string> = {};

          let htmlContent = campaign.html_content;
          if (contact) {
            if (contact.full_name) {
              personalization["FullName"] = contact.full_name;
              htmlContent = htmlContent.replaceAll("[[FullName]]", contact.full_name);
            }
            if (contact.username) {
              personalization["Username"] = contact.username;
              htmlContent = htmlContent.replaceAll("[[Username]]", contact.username);
            }
            if (contact.country) {
              personalization["Country"] = contact.country;
              htmlContent = htmlContent.replaceAll("[[Country]]", contact.country);
            }
            if (contact.email) {
              personalization["Email"] = contact.email;
              htmlContent = htmlContent.replaceAll("[[Email]]", contact.email);
            }
          }

          // Send via Resend API
          const sendResult = await sendViaResend({
            to: recipient.email,
            subject: campaign.subject,
            html: htmlContent,
            from: fromAddress,
            replyTo: campaign.reply_to_email || undefined,
          });

          if (sendResult.success) {
            await supabase
              .from("campaign_recipients")
              .update({
                status: "sent",
                provider_message_id: sendResult.messageId,
                sent_at: new Date().toISOString(),
                personalization,
              })
              .eq("id", recipient.id);

            await supabase.from("email_activity").insert({
              recipient_email: recipient.email,
              campaign_name: campaign.name,
              email_type: "broadcast",
              status: "sent",
              provider_message_id: sendResult.messageId,
              sent_at: new Date().toISOString(),
            });

            sentCount++;
          } else {
            await supabase
              .from("campaign_recipients")
              .update({
                status: "failed",
                error_info: sendResult.error,
              })
              .eq("id", recipient.id);

            await supabase.from("email_activity").insert({
              recipient_email: recipient.email,
              campaign_name: campaign.name,
              email_type: "broadcast",
              status: "failed",
              error_info: sendResult.error,
            });

            await supabase.from("failure_reports").insert({
              recipient_email: recipient.email,
              failure_type: "failed",
              reason: sendResult.error || "Send failed",
              campaign_id: campaignId,
              campaign_name: campaign.name,
              provider_response: sendResult.error || "",
            });

            failedCount++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          await supabase
            .from("campaign_recipients")
            .update({ status: "failed", error_info: errorMsg })
            .eq("id", recipient.id);

          failedCount++;
        }
      }

      // Update campaign stats after each batch
      await supabase
        .from("campaigns")
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq("id", campaignId);
    }

    // Mark campaign as completed
    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq("id", campaignId);

    return jsonResponse({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: eligibleContacts.length,
      suppressed: suppressedCount,
    });
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

async function fetchD1Contacts(count: number | null): Promise<RecipientContact[]> {
  if (!D1_WORKER_ENDPOINT || !D1_WORKER_AUTH_TOKEN) {
    throw new Error("D1_WORKER_ENDPOINT and D1_WORKER_AUTH_TOKEN must be configured as edge function secrets.");
  }

  const body = count ? { count } : { count: 50000 };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${D1_WORKER_ENDPOINT}/contacts/retrieve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${D1_WORKER_AUTH_TOKEN}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Worker returned HTTP ${response.status}: ${text}`);
    }

    const json = await response.json();
    return (json.contacts || []) as RecipientContact[];
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const body: Record<string, string> = {
      to: params.to,
      subject: params.subject,
      html: params.html,
      from: params.from,
    };
    if (params.replyTo) body.reply_to = params.replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || `Resend API error: ${response.status}` };
    }

    return { success: true, messageId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Resend API error" };
  }
}
