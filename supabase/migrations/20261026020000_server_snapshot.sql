-- Phase 2: the app's own rules run in the `api` Edge Function.
--
-- Each request reads the whole (small) dataset with registream_snapshot(),
-- runs one operation on it, and writes back only the rows it changed with
-- registream_apply(). The revision number makes that safe when two people
-- save at once: a write based on an out-of-date read is refused, and the
-- function simply runs the operation again on fresh data.
--
-- Both functions are for the service role only. The browser never reads or
-- writes a table directly; Row Level Security stays on with no policies
-- except "read your own users row".

create table registream_meta (
  id integer primary key check (id = 1),
  revision bigint not null
);
insert into registream_meta values (1, 0);
alter table registream_meta enable row level security;
grant all on registream_meta to service_role;

create or replace function registream_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
  overrides text;
  rows jsonb;
  tables jsonb := '{}';
begin
  for t in
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'registream_meta'
  loop
    -- Dates and timestamps in the exact text form the app itself writes.
    select string_agg(
             format(
               '%L, %s',
               column_name,
               case data_type
                 when 'date' then format('to_char(%I, ''YYYY-MM-DD'')', column_name)
                 else format('to_char(%I at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')', column_name)
               end
             ),
             ', '
           )
      into overrides
      from information_schema.columns
     where table_schema = 'public' and table_name = t.name
       and data_type in ('date', 'timestamp with time zone');
    execute format(
      'select coalesce(jsonb_agg((to_jsonb(r) - ''auth_user_id'') || jsonb_build_object(%s) order by r.id), ''[]'') from public.%I r',
      coalesce(overrides, ''),
      t.name
    ) into rows;
    tables := tables || jsonb_build_object(t.name, rows);
  end loop;
  return jsonb_build_object(
    'revision', (select revision from registream_meta where id = 1),
    'tables', tables
  );
end;
$$;

-- changes: [{ "table": "students", "upsert": [...rows...], "delete": ["id", ...] }, ...]
-- in dependency order (parents first). Upserts run in that order, deletes in reverse.
create or replace function registream_apply(expected bigint, changes jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision bigint;
  change jsonb;
  tbl text;
  cols text;
  updates text;
begin
  select revision into current_revision from registream_meta where id = 1 for update;
  if current_revision <> expected then
    raise exception 'registream: stale snapshot' using errcode = '40001';
  end if;

  for change in select value from jsonb_array_elements(changes) loop
    tbl := change->>'table';
    if tbl = 'registream_meta' or not exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = tbl
    ) then
      raise exception 'registream: unknown table %', tbl;
    end if;
    if jsonb_array_length(coalesce(change->'upsert', '[]')) > 0 then
      -- auth_user_id belongs to Supabase Auth's provisioning, never to the app.
      select string_agg(format('%I', column_name), ', '),
             string_agg(format('%I = excluded.%I', column_name, column_name), ', ')
               filter (where column_name <> 'id')
        into cols, updates
        from information_schema.columns
       where table_schema = 'public' and table_name = tbl and column_name <> 'auth_user_id';
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) on conflict (id) do update set %3$s',
        tbl, cols, updates
      ) using change->'upsert';
    end if;
  end loop;

  for change in select value from jsonb_array_elements(changes) with ordinality as e(value, n) order by n desc loop
    tbl := change->>'table';
    if jsonb_array_length(coalesce(change->'delete', '[]')) > 0 then
      execute format('delete from public.%I where id in (select jsonb_array_elements_text($1))', tbl)
        using change->'delete';
    end if;
  end loop;

  update registream_meta set revision = revision + 1 where id = 1 returning revision into current_revision;
  return current_revision;
end;
$$;

revoke all on function registream_snapshot() from public, anon, authenticated;
revoke all on function registream_apply(bigint, jsonb) from public, anon, authenticated;
grant execute on function registream_snapshot() to service_role;
grant execute on function registream_apply(bigint, jsonb) to service_role;
