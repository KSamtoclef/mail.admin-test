/* Create recipients table for the rebuilt audience model. */
CREATE TABLE IF NOT EXISTS public.recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  username text,
  country text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS recipients_email_unique ON public.recipients (lower(email));
CREATE INDEX IF NOT EXISTS recipients_status_idx ON public.recipients (status);
CREATE INDEX IF NOT EXISTS recipients_created_at_idx ON public.recipients (created_at);
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_recipients" ON public.recipients;
CREATE POLICY "admin_select_recipients" ON public.recipients FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_insert_recipients" ON public.recipients;
CREATE POLICY "admin_insert_recipients" ON public.recipients FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_update_recipients" ON public.recipients;
CREATE POLICY "admin_update_recipients" ON public.recipients FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_delete_recipients" ON public.recipients;
CREATE POLICY "admin_delete_recipients" ON public.recipients FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
CREATE TRIGGER set_updated_at_recipients BEFORE UPDATE ON public.recipients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
