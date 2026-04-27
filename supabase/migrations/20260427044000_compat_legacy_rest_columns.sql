-- Compatibility patch for legacy frontend REST queries.
-- Prevents 400s from missing columns while preserving canonical schema names.

alter table "GrowthPlatform".notifications
  add column if not exists user_id uuid;

alter table "GrowthPlatform".framework_scores
  add column if not exists closer_email text;

alter table "GrowthPlatform".pdi_focus_areas
  add column if not exists closer_email text,
  add column if not exists priority integer;

alter table "GrowthPlatform".pdi_sprint_goals
  add column if not exists closer_email text;

-- Backfill compatibility aliases from canonical columns.
update "GrowthPlatform".framework_scores fs
set closer_email = c.seller_email
from "GrowthPlatform".calls c
where fs.call_id = c.id
  and fs.closer_email is null;

update "GrowthPlatform".pdi_focus_areas
set closer_email = seller_email
where closer_email is null;

update "GrowthPlatform".pdi_sprint_goals
set closer_email = seller_email
where closer_email is null;

-- Deterministic priority fallback when absent.
with ranked as (
  select id, row_number() over (partition by coalesce(closer_email, seller_email) order by created_at asc) as rn
  from "GrowthPlatform".pdi_focus_areas
)
update "GrowthPlatform".pdi_focus_areas p
set priority = ranked.rn
from ranked
where p.id = ranked.id
  and p.priority is null;

-- Keep values in safe display range for UIs expecting 1..3.
update "GrowthPlatform".pdi_focus_areas
set priority = greatest(1, least(priority, 3))
where priority is not null;

