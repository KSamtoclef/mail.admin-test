/*
# Create email_templates table

1. New Tables
- `email_templates` — reusable email templates with categories, personalization tags,
  HTML content, plain text version, and draft state. Templates are reusable inside
  broadcasts and transactional email workflows.

2. Security
- RLS enabled. All policies gated by admin_profiles, scoped TO authenticated.
*/

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  subject text NOT NULL DEFAULT '',
  html_content text NOT NULL DEFAULT '',
  plain_text text DEFAULT '',
  supported_tags text[] DEFAULT ARRAY['FullName','Country','Email']::text[],
  is_draft boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_templates_category_idx ON public.email_templates (category);
CREATE INDEX IF NOT EXISTS email_templates_name_idx ON public.email_templates (name);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_templates" ON public.email_templates;
CREATE POLICY "admin_select_templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_templates" ON public.email_templates;
CREATE POLICY "admin_insert_templates" ON public.email_templates
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_templates" ON public.email_templates;
CREATE POLICY "admin_update_templates" ON public.email_templates
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_templates" ON public.email_templates;
CREATE POLICY "admin_delete_templates" ON public.email_templates
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_email_templates
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
