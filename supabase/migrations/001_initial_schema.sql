-- ============================================================
-- LUMIX Pro - Schema Migration (idempotent, safe to re-run)
-- ============================================================

-- 1. Add missing columns to existing tables

alter table children
  add column if not exists gender text not null default 'male',
  add column if not exists photo_url text,
  add column if not exists notes text;

alter table children
  drop constraint if exists children_gender_check;
alter table children
  add constraint children_gender_check
    check (gender in ('male', 'female', 'other'));

alter table classes
  add column if not exists description text;

alter table activities
  add column if not exists description text,
  add column if not exists activity_date date,
  add column if not exists activity_time time,
  add column if not exists type text not null default 'education',
  add column if not exists status text not null default 'planned';

alter table activities
  drop constraint if exists activities_type_check;
alter table activities
  add constraint activities_type_check
    check (type in ('education', 'therapy', 'recreation', 'counseling', 'other'));

alter table activities
  drop constraint if exists activities_status_check;
alter table activities
  add constraint activities_status_check
    check (status in ('planned', 'ongoing', 'completed', 'cancelled'));

-- 2. Create attendance table
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  check_date date not null,
  status text not null default 'present',
  notes text,
  created_at timestamptz not null default now(),
  constraint attendance_status_check
    check (status in ('present', 'absent', 'late', 'leave')),
  constraint attendance_child_date_unique
    unique (child_id, check_date)
);

-- 3. Enable RLS
alter table classes enable row level security;
alter table children enable row level security;
alter table activities enable row level security;
alter table attendance enable row level security;

-- 4. RLS Policies
drop policy if exists "lumix_classes_select" on classes;
drop policy if exists "lumix_classes_insert" on classes;
drop policy if exists "lumix_classes_update" on classes;
drop policy if exists "lumix_classes_delete" on classes;
create policy "lumix_classes_select" on classes for select to authenticated using (true);
create policy "lumix_classes_insert" on classes for insert to authenticated with check (true);
create policy "lumix_classes_update" on classes for update to authenticated using (true);
create policy "lumix_classes_delete" on classes for delete to authenticated using (true);

drop policy if exists "lumix_children_select" on children;
drop policy if exists "lumix_children_insert" on children;
drop policy if exists "lumix_children_update" on children;
drop policy if exists "lumix_children_delete" on children;
create policy "lumix_children_select" on children for select to authenticated using (true);
create policy "lumix_children_insert" on children for insert to authenticated with check (true);
create policy "lumix_children_update" on children for update to authenticated using (true);
create policy "lumix_children_delete" on children for delete to authenticated using (true);

drop policy if exists "lumix_activities_select" on activities;
drop policy if exists "lumix_activities_insert" on activities;
drop policy if exists "lumix_activities_update" on activities;
drop policy if exists "lumix_activities_delete" on activities;
create policy "lumix_activities_select" on activities for select to authenticated using (true);
create policy "lumix_activities_insert" on activities for insert to authenticated with check (true);
create policy "lumix_activities_update" on activities for update to authenticated using (true);
create policy "lumix_activities_delete" on activities for delete to authenticated using (true);

drop policy if exists "lumix_attendance_select" on attendance;
drop policy if exists "lumix_attendance_insert" on attendance;
drop policy if exists "lumix_attendance_update" on attendance;
drop policy if exists "lumix_attendance_delete" on attendance;
create policy "lumix_attendance_select" on attendance for select to authenticated using (true);
create policy "lumix_attendance_insert" on attendance for insert to authenticated with check (true);
create policy "lumix_attendance_update" on attendance for update to authenticated using (true);
create policy "lumix_attendance_delete" on attendance for delete to authenticated using (true);

-- 5. Indexes
create index if not exists idx_children_class_id on children(class_id);
create index if not exists idx_children_status on children(status);
create index if not exists idx_activities_class_id on activities(class_id);
create index if not exists idx_activities_date on activities(activity_date);
create index if not exists idx_attendance_date on attendance(check_date);
create index if not exists idx_attendance_child_id on attendance(child_id);
create index if not exists idx_attendance_center_id on attendance(center_id);
