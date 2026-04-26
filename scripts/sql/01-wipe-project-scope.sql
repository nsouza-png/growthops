drop schema if exists "GrowthPlatform" cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'calls'
  ) then
    execute 'drop trigger if exists trg_sync_call_to_gp on public.calls';
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      oidvectortypes(p.proargtypes) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'gp_%'
        or p.proname like '%_gp_%'
        or p.proname = 'trg_fn_sync_call_to_gp'
      )
  loop
    execute format(
      'drop function if exists %I.%I(%s) cascade',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end
$$;
