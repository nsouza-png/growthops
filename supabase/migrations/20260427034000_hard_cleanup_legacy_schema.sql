-- HARD CLEANUP (approved): remove confirmed legacy schema.
-- This migration is destructive by design.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'growth_platform') then
    execute 'drop schema growth_platform cascade';
  end if;
end $$;

