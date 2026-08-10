/*
# Create helper function and admin_profiles table

1. New Functions
- `set_updated_at()` — trigger function that updates the updated_at column on row modification.

2. New Tables
- `admin_profiles` — links to auth.users, stores display name, role, avatar, last active.

3. Security
- RLS enabled on admin_profiles.
- Admin membership is provisioned server-side; signed-in users cannot self-promote.
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
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_insert_profiles" ON public.admin_profiles;

DROP POLICY IF EXISTS "admin_update_profiles" ON public.admin_profiles;
CREATE POLICY "admin_update_profiles" ON public.admin_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.admin_profiles;

CREATE TRIGGER set_updated_at_admin_profiles
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
