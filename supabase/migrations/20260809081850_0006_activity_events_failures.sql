/*
# Create email_activity, delivery_events, and failure_reports tables

1. New Tables
- `email_activity` — unified activity log showing individual email activity across broadcasts,
  transactional, and test emails.
- `delivery_events` — granular provider events (sent, delivered, bounced, opened, clicked,
  complained) linked to campaign recipients.
- `failure_reports` — dedicated failure management for hard bounces, soft bounces, spam
  complaints, failed deliveries, and rejected emails.

2. Relationships
- delivery_events.campaign_recipient_id -> campaign_recipients.id (SET NULL)
- failure_reports.campaign_id -> campaigns.id (SET NULL)

3. Security
- RLS enabled on all. All policies gated by admin_profiles, scoped TO authenticated.
*/

CREATE TABLE IF NOT EXISTS public.email_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  campaign_name text,
  email_type text NOT NULL DEFAULT 'broadcast',
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_info text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ea_recipient_idx ON public.email_activity (recipient_email);
CREATE INDEX IF NOT EXISTS ea_status_idx ON public.email_activity (status);
CREATE INDEX IF NOT EXISTS ea_email_type_idx ON public.email_activity (email_type);
CREATE INDEX IF NOT EXISTS ea_created_at_idx ON public.email_activity (created_at);

ALTER TABLE public.email_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ea" ON public.email_activity;
CREATE POLICY "admin_select_ea" ON public.email_activity
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_ea" ON public.email_activity;
CREATE POLICY "admin_insert_ea" ON public.email_activity
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_ea" ON public.email_activity;
CREATE POLICY "admin_update_ea" ON public.email_activity
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_ea" ON public.email_activity;
CREATE POLICY "admin_delete_ea" ON public.email_activity
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_email_activity
  BEFORE UPDATE ON public.email_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  provider_message_id text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS de_cr_id_idx ON public.delivery_events (campaign_recipient_id);
CREATE INDEX IF NOT EXISTS de_event_type_idx ON public.delivery_events (event_type);

ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_de" ON public.delivery_events;
CREATE POLICY "admin_select_de" ON public.delivery_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_de" ON public.delivery_events;
CREATE POLICY "admin_insert_de" ON public.delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_de" ON public.delivery_events;
CREATE POLICY "admin_delete_de" ON public.delivery_events
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.failure_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  failure_type text NOT NULL DEFAULT 'failed',
  reason text DEFAULT '',
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  campaign_name text,
  provider_response text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fr_failure_type_idx ON public.failure_reports (failure_type);
CREATE INDEX IF NOT EXISTS fr_recipient_idx ON public.failure_reports (recipient_email);
CREATE INDEX IF NOT EXISTS fr_created_at_idx ON public.failure_reports (created_at);

ALTER TABLE public.failure_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_fr" ON public.failure_reports;
CREATE POLICY "admin_select_fr" ON public.failure_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_fr" ON public.failure_reports;
CREATE POLICY "admin_insert_fr" ON public.failure_reports
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_fr" ON public.failure_reports;
CREATE POLICY "admin_update_fr" ON public.failure_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_fr" ON public.failure_reports;
CREATE POLICY "admin_delete_fr" ON public.failure_reports
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_failure_reports
  BEFORE UPDATE ON public.failure_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
