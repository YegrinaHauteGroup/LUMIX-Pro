-- ============================================================
-- Migration 014: facility geolocation + dashboard external feed cache
--   * centers: latitude/longitude/region for location-based widgets
--   * dashboard_feeds: cached weather + news + policy per center
--     (populated by the dashboard_feed edge function, 5-min refresh)
-- ============================================================
alter table public.centers
  add column if not exists latitude    numeric,
  add column if not exists longitude   numeric,
  add column if not exists region_code text,
  add column if not exists region_name text;

create table if not exists public.dashboard_feeds (
  center_id  uuid primary key references public.centers(id) on delete cascade,
  location   jsonb not null default '{}'::jsonb,
  weather    jsonb,
  news       jsonb,
  policy     jsonb,
  error      text,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_feeds enable row level security;
drop policy if exists dashboard_feeds_sel on public.dashboard_feeds;
drop policy if exists dashboard_feeds_ins on public.dashboard_feeds;
drop policy if exists dashboard_feeds_upd on public.dashboard_feeds;
create policy dashboard_feeds_sel on public.dashboard_feeds for select to authenticated
  using (center_id = public.current_user_center_id());
create policy dashboard_feeds_ins on public.dashboard_feeds for insert to authenticated
  with check (center_id = public.current_user_center_id());
create policy dashboard_feeds_upd on public.dashboard_feeds for update to authenticated
  using (center_id = public.current_user_center_id()) with check (center_id = public.current_user_center_id());
