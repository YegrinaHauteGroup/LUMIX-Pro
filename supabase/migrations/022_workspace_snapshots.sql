-- ============================================================
-- LUMIX Pro - workspace_snapshots
-- ------------------------------------------------------------
-- Timestamped snapshots of the entire workspace (memos + info +
-- links + file metadata). Saved via "저장", listed and selectively
-- restored via "불러오기".
-- ============================================================
create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  author_staff_id uuid,
  title text,
  items jsonb not null default '[]'::jsonb,
  item_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workspace_snapshots enable row level security;

drop policy if exists workspace_snapshots_sel on public.workspace_snapshots;
drop policy if exists workspace_snapshots_ins on public.workspace_snapshots;
drop policy if exists workspace_snapshots_del on public.workspace_snapshots;

create policy workspace_snapshots_sel on public.workspace_snapshots
  for select using (center_id = current_user_center_id());
create policy workspace_snapshots_ins on public.workspace_snapshots
  for insert with check (center_id = current_user_center_id());
create policy workspace_snapshots_del on public.workspace_snapshots
  for delete using (center_id = current_user_center_id());

create index if not exists workspace_snapshots_center_idx
  on public.workspace_snapshots (center_id, created_at desc);
