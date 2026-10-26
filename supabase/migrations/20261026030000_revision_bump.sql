-- The `accounts` function writes users rows itself (password flags). Bumping
-- the revision makes any `api` request that read the old row run again
-- rather than write the old flag back.
create or replace function registream_bump()
returns bigint
language sql
security definer
set search_path = public
as $$
  update registream_meta set revision = revision + 1 where id = 1 returning revision;
$$;
revoke all on function registream_bump() from public, anon, authenticated;
grant execute on function registream_bump() to service_role;
