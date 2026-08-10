-- Security hardening: browser users may read only their own admin row.
-- Admin rows must be provisioned server-side for an existing Supabase Auth user.

drop policy if exists "admin_insert_profiles" on public.admin_profiles;
drop policy if exists "admin_update_profiles" on public.admin_profiles;
drop policy if exists "admin_delete_profiles" on public.admin_profiles;

drop policy if exists "admin_select_profiles" on public.admin_profiles;
create policy "admin_select_profiles" on public.admin_profiles
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.admin_profiles from authenticated;
