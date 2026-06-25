-- ============================================================
-- Migration 013: analysis_quests (idempotent repo parity)
-- The quest engine table that backs the run_quest edge function.
-- A user defines an analysis "quest"; the edge function runs it over
-- the center's ontology data and writes a structured result back.
-- ============================================================
create table if not exists public.analysis_quests (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  title text not null,
  quest_type text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  result jsonb,
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint analysis_quests_status_chk check (status in ('pending','running','done','error'))
);
create index if not exists idx_analysis_quests_center on public.analysis_quests(center_id, created_at desc) where deleted_at is null;

alter table public.analysis_quests enable row level security;
drop policy if exists analysis_quests_sel on public.analysis_quests;
drop policy if exists analysis_quests_ins on public.analysis_quests;
drop policy if exists analysis_quests_upd on public.analysis_quests;
drop policy if exists analysis_quests_del on public.analysis_quests;
create policy analysis_quests_sel on public.analysis_quests for select to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null);
create policy analysis_quests_ins on public.analysis_quests for insert to authenticated
  with check (center_id = public.current_user_center_id());
create policy analysis_quests_upd on public.analysis_quests for update to authenticated
  using (center_id = public.current_user_center_id()) with check (center_id = public.current_user_center_id());
create policy analysis_quests_del on public.analysis_quests for delete to authenticated
  using (center_id = public.current_user_center_id());

drop trigger if exists set_analysis_quests_updated_at on public.analysis_quests;
create trigger set_analysis_quests_updated_at before update on public.analysis_quests
  for each row execute function public.set_updated_at();
