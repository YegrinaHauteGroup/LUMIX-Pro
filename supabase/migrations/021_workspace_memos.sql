-- ============================================================
-- LUMIX Pro - workspace_memos
-- ------------------------------------------------------------
-- Backing store for the right-side Workspace panel. Memo pads /
-- collected widgets are integrated ("데이터 통합") into the center's
-- facility data here, and reloaded via "저장된 메모패드 불러오기".
-- ============================================================
create table if not exists public.workspace_memos (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  author_staff_id uuid,
  title text,
  body text not null default '',
  mentions jsonb not null default '[]'::jsonb,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.workspace_memos enable row level security;

drop policy if exists workspace_memos_sel on public.workspace_memos;
drop policy if exists workspace_memos_ins on public.workspace_memos;
drop policy if exists workspace_memos_upd on public.workspace_memos;

create policy workspace_memos_sel on public.workspace_memos
  for select using (center_id = current_user_center_id() and deleted_at is null);
create policy workspace_memos_ins on public.workspace_memos
  for insert with check (center_id = current_user_center_id());
create policy workspace_memos_upd on public.workspace_memos
  for update using (center_id = current_user_center_id());

create index if not exists workspace_memos_center_idx
  on public.workspace_memos (center_id, created_at desc);
