-- ============================================================
-- LUMIX Pro - Migration 006: RLS policies for guardian_profiles
-- and the legacy attendance table (both had RLS on / no policy).
-- ============================================================

-- guardian_profiles: mirror the center-scoped pattern of sibling tables.
drop policy if exists guardian_profiles_sel on public.guardian_profiles;
drop policy if exists guardian_profiles_ins on public.guardian_profiles;
drop policy if exists guardian_profiles_upd on public.guardian_profiles;

create policy guardian_profiles_sel on public.guardian_profiles
  for select to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null);
create policy guardian_profiles_ins on public.guardian_profiles
  for insert to authenticated
  with check (center_id = public.current_user_center_id() and deleted_at is null);
create policy guardian_profiles_upd on public.guardian_profiles
  for update to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null)
  with check (center_id = public.current_user_center_id());

-- Legacy public.attendance (used by the attendance UI) has no center_id,
-- so scope through the child's center.
drop policy if exists attendance_all on public.attendance;
create policy attendance_all on public.attendance
  for all to authenticated
  using (exists (
    select 1 from public.children c
    where c.id = attendance.child_id and c.center_id = public.current_user_center_id()
  ))
  with check (exists (
    select 1 from public.children c
    where c.id = attendance.child_id and c.center_id = public.current_user_center_id()
  ));
