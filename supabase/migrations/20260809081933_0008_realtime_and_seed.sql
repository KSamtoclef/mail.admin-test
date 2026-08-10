/*
# Enable realtime and seed initial data

1. Realtime
- Add campaigns, campaign_recipients, email_activity, and transactional_logs to the
  realtime publication so the dashboard can observe live progress.

2. Seed Data
- Insert a default Resend provider_settings row (is_connected = false until the admin
  configures the API key via edge function secrets).
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactional_logs;

INSERT INTO public.provider_settings (provider_name, is_active, is_connected, sender_name, sender_email, reply_to_email, connect_id)
VALUES ('resend', true, false, '', '', '', 'CONNECT_ID_PLACEHOLDER')
ON CONFLICT (provider_name) DO NOTHING;
