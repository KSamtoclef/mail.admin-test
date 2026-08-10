-- Fix recursive RLS policies on admin_profiles
-- The old policies used EXISTS (SELECT 1 FROM admin_profiles ...) which caused
-- infinite recursion when evaluated on the admin_profiles table itself.

DROP POLICY IF EXISTS "admin_select_profiles" ON public.admin_profiles;
CREATE POLICY "admin_select_profiles" ON public.admin_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_insert_profiles" ON public.admin_profiles;
CREATE POLICY "admin_insert_profiles" ON public.admin_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_profiles" ON public.admin_profiles;
CREATE POLICY "admin_update_profiles" ON public.admin_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_delete_profiles" ON public.admin_profiles;
CREATE POLICY "admin_delete_profiles" ON public.admin_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
