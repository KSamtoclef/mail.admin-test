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

    // Fetch all resend_events from the database (source of truth for analytics)
    const { data: events, error: dbError } = await supabase
      .from("resend_events")
      .select("event_type, email_id, event_created_at");

    if (dbError) {
      return jsonResponse({ error: "Failed to fetch analytics data" }, 500);
    }

    const allEvents = events ?? [];

    // Count events by type
    const totalSent = allEvents.filter((e) => e.event_type === "email.sent").length;
    const successfulDeliveries = allEvents.filter((e) => e.event_type === "email.delivered").length;
    const failedDeliveries = allEvents.filter((e) => e.event_type === "email.failed").length;
    const bounces = allEvents.filter((e) => e.event_type === "email.bounced").length;
    const spamComplaints = allEvents.filter((e) => e.event_type === "email.complained").length;

    // Unique opens and clicks (deduplicate by email_id)
    const openedEvents = allEvents.filter((e) => e.event_type === "email.opened");
    const uniqueOpens = new Set(openedEvents.map((e) => e.email_id).filter(Boolean)).size;

    const clickedEvents = allEvents.filter((e) => e.event_type === "email.clicked");
    const uniqueClicks = new Set(clickedEvents.map((e) => e.email_id).filter(Boolean)).size;

    // Calculate rates safely
    const deliveryRate = totalSent > 0 ? (successfulDeliveries / totalSent) * 100 : 0;
    const openRate = successfulDeliveries > 0 ? (uniqueOpens / successfulDeliveries) * 100 : 0;
    const clickThroughRate = successfulDeliveries > 0 ? (uniqueClicks / successfulDeliveries) * 100 : 0;

    // Fetch domain tracking configuration from Resend to determine if open/click tracking is enabled
    let openTrackingEnabled = true;
    let clickTrackingEnabled = true;

    if (RESEND_API_KEY) {
      try {
        const domainsResponse = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });

        if (domainsResponse.ok) {
          const domainsData = await domainsResponse.json();
          const domains = domainsData.data ?? [];

          // Fetch the first verified domain's tracking settings
          for (const d of domains) {
            const detailResponse = await fetch(`https://api.resend.com/domains/${d.id}`, {
              headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            });
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              if (detail.open_tracking !== undefined) {
                openTrackingEnabled = detail.open_tracking;
              }
              if (detail.click_tracking !== undefined) {
                clickTrackingEnabled = detail.click_tracking;
              }
              if (detail.status === "verified") break;
            }
          }
        }
      } catch {
        // If we can't fetch domain config, default to true
      }
    }

    // Also fetch active campaign count for the dashboard
    const { count: activeCampaigns } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .in("status", ["sending", "scheduled"]);

    // Fetch 30-day trend data from resend_events
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: trendEvents } = await supabase
      .from("resend_events")
      .select("event_type, event_created_at")
      .gte("event_created_at", thirtyDaysAgo.toISOString());

    const trendByDate = new Map<string, { date: string; sent: number; delivered: number; opened: number }>();
    for (const ev of trendEvents ?? []) {
      const dateStr = (ev.event_created_at ?? new Date().toISOString()).slice(0, 10);
      const entry = trendByDate.get(dateStr) ?? { date: dateStr, sent: 0, delivered: 0, opened: 0 };
      switch (ev.event_type) {
        case "email.sent": entry.sent++; break;
        case "email.delivered": entry.delivered++; break;
        case "email.opened": entry.opened++; break;
      }
      trendByDate.set(dateStr, entry);
    }

    const trends = Array.from(trendByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    return jsonResponse({
      totalSent,
      successfulDeliveries,
      deliveryRate,
      openRate,
      clickThroughRate,
      failedDeliveries,
      bounces,
      spamComplaints,
      openTrackingEnabled,
      clickTrackingEnabled,
      activeCampaigns: activeCampaigns ?? 0,
      trends,
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
