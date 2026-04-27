-- Safe cleanup phase (non-destructive):
-- - no DROP statements
-- - quarantine only legacy surface
-- - register candidates for later hard-delete phase

create table if not exists "GrowthPlatform".cleanup_deprecation_registry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  object_type text not null,
  object_name text not null,
  reason text not null,
  status text not null default 'candidate',
  reviewed_by text,
  reviewed_at timestamptz
);

comment on table "GrowthPlatform".cleanup_deprecation_registry is
  'Safe cleanup inventory for staged deprecation (no hard drops).';

insert into "GrowthPlatform".cleanup_deprecation_registry (object_type, object_name, reason, status)
values
  ('schema', 'growth_platform', 'Legacy lowercase schema; canonical schema is "GrowthPlatform".', 'candidate')
on conflict do nothing;

do $$
begin
  -- Quarantine legacy schema access for app roles, if schema exists.
  if exists (select 1 from information_schema.schemata where schema_name = 'growth_platform') then
    execute 'revoke usage on schema growth_platform from anon';
    execute 'revoke usage on schema growth_platform from authenticated';
  end if;
end $$;

