-- ============================================================
-- LUMIX Pro - Migration 002: Centers table setup
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- 1. Ensure centers table exists with correct structure
create table if not exists centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- 2. Enable RLS on centers
alter table centers enable row level security;

-- 3. RLS policies for centers (authenticated users can read/write)
drop policy if exists "lumix_centers_select" on centers;
drop policy if exists "lumix_centers_insert" on centers;
drop policy if exists "lumix_centers_update" on centers;

create policy "lumix_centers_select" on centers
  for select to authenticated using (true);

create policy "lumix_centers_insert" on centers
  for insert to authenticated with check (true);

create policy "lumix_centers_update" on centers
  for update to authenticated using (true);

-- 4. Add center_id column to children if missing (safety check)
alter table children
  add column if not exists center_id uuid references centers(id) on delete cascade;

-- 5. Add center_id column to classes if missing (safety check)
alter table classes
  add column if not exists center_id uuid references centers(id) on delete cascade;

-- 6. Add center_id column to activities if missing (safety check)
alter table activities
  add column if not exists center_id uuid references centers(id) on delete cascade;

-- 7. Index for centers lookups
create index if not exists idx_children_center_id on children(center_id);
create index if not exists idx_classes_center_id on classes(center_id);
create index if not exists idx_activities_center_id on activities(center_id);
