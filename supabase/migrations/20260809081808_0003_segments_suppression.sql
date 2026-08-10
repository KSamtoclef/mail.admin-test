/* Create saved audience segments and suppression list. */
CREATE TABLE IF NOT EXISTS public.user_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_segments_name_idx ON public.user_segments (name);
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_segments" ON public.user_segments;
CREATE POLICY "admin_select_segments" ON public.user_segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_insert_segments" ON public.user_segments;
CREATE POLICY "admin_insert_segments" ON public.user_segments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_update_segments" ON public.user_segments;
CREATE POLICY "admin_update_segments" ON public.user_segments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_delete_segments" ON public.user_segments;
CREATE POLICY "admin_delete_segments" ON public.user_segments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
CREATE TRIGGER set_updated_at_user_segments BEFORE UPDATE ON public.user_segments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'manual_block',
  source text DEFAULT 'manual',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suppression_email_lower_idx ON public.suppression_list (lower(email));
CREATE INDEX IF NOT EXISTS suppression_reason_idx ON public.suppression_list (reason);
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_suppression" ON public.suppression_list;
CREATE POLICY "admin_select_suppression" ON public.suppression_list FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_insert_suppression" ON public.suppression_list;
CREATE POLICY "admin_insert_suppression" ON public.suppression_list FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_update_suppression" ON public.suppression_list;
CREATE POLICY "admin_update_suppression" ON public.suppression_list FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
DROP POLICY IF EXISTS "admin_delete_suppression" ON public.suppression_list;
CREATE POLICY "admin_delete_suppression" ON public.suppression_list FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));
CREATE TRIGGER set_updated_at_suppression_list BEFORE UPDATE ON public.suppression_list FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
