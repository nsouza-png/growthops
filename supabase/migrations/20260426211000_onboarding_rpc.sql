-- Ensure authenticated users can complete onboarding without direct table UPDATE.
-- Uses SECURITY DEFINER to avoid granting broad UPDATE on user_roles.

create or replace function public.complete_user_onboarding(p_preferred_name text default null)
returns void
language plpgsql
security definer
set search_path = public, "GrowthPlatform"
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_user_id;

  insert into "GrowthPlatform".user_roles (
    user_id,
    email,
    role,
    is_active,
    onboarding_completed,
    preferred_name
  )
  values (
    v_user_id,
    v_email,
    'executivo',
    true,
    true,
    nullif(trim(p_preferred_name), '')
  )
  on conflict (user_id) do update
    set onboarding_completed = true,
        preferred_name = coalesce(nullif(trim(excluded.preferred_name), ''), "GrowthPlatform".user_roles.preferred_name),
        email = coalesce(excluded.email, "GrowthPlatform".user_roles.email);
end;
$$;

grant execute on function public.complete_user_onboarding(text) to authenticated, service_role;
