/*
# Create resend_events table for webhook event storage

1. New Tables
- `resend_events` — persistent store for every incoming Resend webhook event.
  - `svix_id` (text, unique) — the Svix message ID from the webhook header, used for idempotency/deduplication.
  - `event_type` (text) — the Resend event type (email.sent, email.delivered, email.opened, email.clicked, email.failed, email.bounced, email.complained).
  - `email_id` (text) — Resend's email/message identifier from the event payload.
  - `recipient_email` (text) — the recipient email address from the event payload, if available.
  - `subject` (text) — the email subject from the event payload, if available.
  - `event_created_at` (timestamptz) — the timestamp from the Resend event payload.
  - `raw_payload` (jsonb) — the full raw webhook event payload for audit/debugging.
  - `created_at` (timestamptz) — when the record was inserted into our database.

2. Indexes
- Unique index on `svix_id` to prevent duplicate webhook deliveries.
- Index on `event_type` for dashboard aggregation queries.
- Index on `email_id` for unique open/click counting.
- Index on `event_created_at` for date-range queries and trend charts.

3. Security
- RLS enabled. The webhook edge function inserts using the service role key (bypasses RLS).
- SELECT policy for authenticated admin users (gated by admin_profiles).
- No INSERT/UPDATE/DELETE policies for frontend users — only the service role can write.
*/

CREATE TABLE IF NOT EXISTS public.resend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  svix_id text UNIQUE,
  event_type text NOT NULL,
  email_id text,
  recipient_email text,
  subject text,
  event_created_at timestamptz,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS re_svix_id_idx ON public.resend_events (svix_id);
CREATE INDEX IF NOT EXISTS re_event_type_idx ON public.resend_events (event_type);
CREATE INDEX IF NOT EXISTS re_email_id_idx ON public.resend_events (email_id);
CREATE INDEX IF NOT EXISTS re_event_created_at_idx ON public.resend_events (event_created_at);

ALTER TABLE public.resend_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_re" ON public.resend_events;
CREATE POLICY "admin_select_re" ON public.resend_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
