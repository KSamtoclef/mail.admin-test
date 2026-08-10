-- Lock admin bootstrap so an arbitrary authenticated user cannot promote themselves.
-- Admin rows must be provisioned server-side (Dashboard SQL/service role) after the auth user exists.

drop policy if exists "admin_insert_profiles" on public.admin_profiles;
drop policy if exists "admin_update_profiles" on public.admin_profiles;
drop policy if exists "admin_delete_profiles" on public.admin_profiles;

drop policy if exists "admin_select_profiles" on public.admin_profiles;
create policy "admin_select_profiles" on public.admin_profiles
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.admin_profiles from authenticated;
