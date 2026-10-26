-- Phase 1: Supabase Auth.
--
-- The service role (used only inside Edge Functions, never in the browser) may
-- work on every table. A signed-in person may read their own `users` row — the
-- app needs its role, status and must-change-password flag at sign-in — and
-- nothing else yet; the role policies for the rest arrive in Phase 2.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

grant select on public.users to authenticated;
create policy "users read their own account"
  on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));
