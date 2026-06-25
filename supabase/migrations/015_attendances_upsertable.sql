-- ============================================================
-- Migration 015: make the canonical attendances table upsertable
--   * unique (child_id, attendance_date) for ON CONFLICT upserts
--   * DELETE policy so toggling a mark off works
-- ============================================================
delete from public.attendances a using public.attendances b
  where a.child_id=b.child_id and a.attendance_date=b.attendance_date and a.ctid < b.ctid;

create unique index if not exists uq_attendances_child_date
  on public.attendances (child_id, attendance_date);

drop policy if exists attendances_del on public.attendances;
create policy attendances_del on public.attendances for delete to authenticated
  using (center_id = public.current_user_center_id());
