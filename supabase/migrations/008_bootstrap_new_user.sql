-- ============================================================
-- LUMIX Pro - Migration 008: self-onboarding for new sign-ups
-- A new user has no staff_profile, so current_user_center_id() is null
-- and every center-scoped RLS policy blocks them. This SECURITY DEFINER
-- function creates a center + director profile for the caller on first
-- use (idempotent), enabling the login-page signup flow.
-- ============================================================
create or replace function public.bootstrap_new_user(p_center_name text default null, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_center uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select center_id into v_center
  from public.staff_profiles
  where user_id = v_uid and deleted_at is null
  limit 1;
  if v_center is not null then return v_center; end if;

  insert into public.centers (name)
  values (coalesce(nullif(trim(p_center_name), ''), '내 센터'))
  returning id into v_center;

  insert into public.staff_profiles (center_id, user_id, name, pin_hash, role)
  values (
    v_center, v_uid,
    coalesce(nullif(trim(p_display_name), ''),
             (select raw_user_meta_data->>'name' from auth.users where id = v_uid),
             '관리자'),
    'signup', 'director'
  );

  return v_center;
end;
$$;

revoke all on function public.bootstrap_new_user(text, text) from public, anon;
grant execute on function public.bootstrap_new_user(text, text) to authenticated;
