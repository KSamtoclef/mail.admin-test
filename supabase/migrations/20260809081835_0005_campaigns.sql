/*
# Create campaigns and campaign_recipients tables

1. New Tables
- `campaigns` — broadcast campaigns with subject, sender, body, audience config, status,
  schedule, and aggregate stats columns.
- `campaign_recipients` — per-recipient send results linked to a campaign, tracking status,
  provider message ID, personalization data, error info, and event timestamps.

2. Relationships
- campaign_recipients.campaign_id -> campaigns.id (CASCADE)

3. Security
- RLS enabled on both. All policies gated by admin_profiles, scoped TO authenticated.
*/

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  sender_name text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  reply_to_email text DEFAULT '',
  html_content text NOT NULL DEFAULT '',
  plain_text text DEFAULT '',
  audience_type text NOT NULL DEFAULT 'all_users',
  segment_ids uuid[] DEFAULT ARRAY[]::uuid[],
  batch_size integer DEFAULT 100,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients integer DEFAULT 0,
  suppressed_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  complained_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx ON public.campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON public.campaigns (created_at);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_campaigns" ON public.campaigns;
CREATE POLICY "admin_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_campaigns" ON public.campaigns;
CREATE POLICY "admin_insert_campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_campaigns" ON public.campaigns;
CREATE POLICY "admin_update_campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_campaigns" ON public.campaigns;
CREATE POLICY "admin_delete_campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  personalization jsonb DEFAULT '{}'::jsonb,
  error_info text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_campaign_id_idx ON public.campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS cr_email_idx ON public.campaign_recipients (email);
CREATE INDEX IF NOT EXISTS cr_status_idx ON public.campaign_recipients (status);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_cr" ON public.campaign_recipients;
CREATE POLICY "admin_select_cr" ON public.campaign_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_cr" ON public.campaign_recipients;
CREATE POLICY "admin_insert_cr" ON public.campaign_recipients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_cr" ON public.campaign_recipients;
CREATE POLICY "admin_update_cr" ON public.campaign_recipients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_cr" ON public.campaign_recipients;
CREATE POLICY "admin_delete_cr" ON public.campaign_recipients
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_campaign_recipients
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
