-- Create GrowthPlatform.profiles row for the current auth user when missing.
-- RLS only allows SELECT on profiles for authenticated; inserts go through SECURITY DEFINER.

create or replace function public.ensure_gp_profile()
returns void
language plpgsql
security definer
set search_path = public, "GrowthPlatform"
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    lower(trim(u.email)),
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), '')
  into v_email, v_full_name
  from auth.users u
  where u.id = v_user_id;

  select ur.role into v_role
  from "GrowthPlatform".user_roles ur
  where ur.user_id = v_user_id
  limit 1;

  v_role := coalesce(nullif(trim(v_role), ''), 'executivo');

  if v_role not in ('executivo', 'coordenador', 'gerente', 'diretor', 'sales_ops', 'admin') then
    v_role := 'executivo';
  end if;

  insert into "GrowthPlatform".profiles (
    id,
    email,
    full_name,
    role,
    updated_at
  )
  values (
    v_user_id,
    v_email,
    coalesce(v_full_name, split_part(v_email, '@', 1)),
    v_role,
    now()
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, "GrowthPlatform".profiles.email),
        full_name = coalesce(nullif(trim(excluded.full_name), ''), "GrowthPlatform".profiles.full_name),
        role = case
          when "GrowthPlatform".profiles.role in ('executivo', 'coordenador', 'gerente', 'diretor', 'sales_ops', 'admin')
            then "GrowthPlatform".profiles.role
          else excluded.role
        end,
        updated_at = now();
end;
$$;

grant execute on function public.ensure_gp_profile() to authenticated, service_role;
