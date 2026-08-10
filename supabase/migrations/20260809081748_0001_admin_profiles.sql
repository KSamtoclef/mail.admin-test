/*
# Create helper function and admin_profiles table

1. New Functions
- `set_updated_at()` — trigger function that updates the updated_at column on row modification.

2. New Tables
- `admin_profiles` — links to auth.users, stores display name, role, avatar, last active.

3. Security
- RLS enabled on admin_profiles.
- All policies scoped TO authenticated, gated by user_id matching the current user.
- SELECT/INSERT/UPDATE/DELETE policies.
*/

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin',
  avatar_url text,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_profiles" ON public.admin_profiles;
CREATE POLICY "admin_select_profiles" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_insert_profiles" ON public.admin_profiles;
CREATE POLICY "admin_insert_profiles" ON public.admin_profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_update_profiles" ON public.admin_profiles;
CREATE POLICY "admin_update_profiles" ON public.admin_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.admin_profiles;
CREATE POLICY "admin_delete_profiles" ON public.admin_profiles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_admin_profiles
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
