-- Sync auth.users -> GrowthPlatform.user_roles with controlled admin assignment.
-- Goal:
-- 1) Guarantee every auth user has a user_roles row.
-- 2) Keep default role as 'executivo'.
-- 3) Promote to 'admin' ONLY users explicitly listed as gerente/sales_ops owners.
--
-- Usage:
-- - Review and edit the admin_emails CTE below.
-- - Run in Supabase SQL Editor (or `supabase db query --linked -f scripts/sql/03-sync-user-roles.sql`).
-- - Re-run scripts/audit-roles.js after execution.

begin;

-- 0) Explicit allowlist for admin users (gerente / sales_ops only).
-- Fill this list with real emails before running in production.
with admin_emails(email) as (
  values
    -- ('gerente.nome@g4educacao.com'),
    -- ('sales.ops@g4educacao.com')
    ('__replace_me__@example.com')
),

-- 1) Ensure all auth users have a row in GrowthPlatform.user_roles.
upserted as (
  insert into "GrowthPlatform".user_roles (
    user_id,
    email,
    role,
    is_active,
    onboarding_completed
  )
  select
    u.id,
    lower(u.email),
    'executivo',
    true,
    false
  from auth.users u
  where u.email is not null
  on conflict (user_id) do update
    set email = excluded.email
  returning user_id
),

-- 2) Normalize all roles to executivo first (single source of truth).
normalized as (
  update "GrowthPlatform".user_roles ur
  set role = 'executivo'
  where ur.role is distinct from 'executivo'
  returning ur.user_id
)

-- 3) Promote only allowlisted admin emails.
update "GrowthPlatform".user_roles ur
set role = 'admin'
from admin_emails a
where lower(coalesce(ur.email, '')) = lower(a.email)
  and a.email not like '__replace_me__@%';

-- 4) Safety report (result visible in SQL Editor output).
select
  count(*) as total_users,
  count(*) filter (where role = 'admin') as admins,
  count(*) filter (where role = 'coordenador') as coordenadores,
  count(*) filter (where role = 'executivo') as executivos
from "GrowthPlatform".user_roles;

commit;
