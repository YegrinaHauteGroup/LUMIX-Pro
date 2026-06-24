-- ============================================================
-- Migration 009: ontology expansion of the Child object + family links
-- ============================================================
alter table public.children
  add column if not exists postal_code             text,
  add column if not exists school_name             text,
  add column if not exists grade_level             text,
  add column if not exists learning_level          text,
  add column if not exists characteristics         text,
  add column if not exists dietary_notes           text,
  add column if not exists developmental_notes     text,
  add column if not exists nationality             text,
  add column if not exists native_language         text,
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text;

create table if not exists public.child_guardians (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  guardian_id uuid not null references public.guardian_profiles(id) on delete cascade,
  relationship text not null default 'guardian',
  is_primary boolean not null default false,
  is_emergency_contact boolean not null default false,
  can_pickup boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint child_guardians_unique unique (child_id, guardian_id)
);
create index if not exists idx_child_guardians_child on public.child_guardians(child_id) where deleted_at is null;
create index if not exists idx_child_guardians_center on public.child_guardians(center_id) where deleted_at is null;

alter table public.child_guardians enable row level security;
drop policy if exists child_guardians_sel on public.child_guardians;
drop policy if exists child_guardians_ins on public.child_guardians;
drop policy if exists child_guardians_upd on public.child_guardians;
drop policy if exists child_guardians_del on public.child_guardians;
create policy child_guardians_sel on public.child_guardians for select to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null);
create policy child_guardians_ins on public.child_guardians for insert to authenticated
  with check (center_id = public.current_user_center_id());
create policy child_guardians_upd on public.child_guardians for update to authenticated
  using (center_id = public.current_user_center_id()) with check (center_id = public.current_user_center_id());
create policy child_guardians_del on public.child_guardians for delete to authenticated
  using (center_id = public.current_user_center_id());

drop trigger if exists set_child_guardians_updated_at on public.child_guardians;
create trigger set_child_guardians_updated_at before update on public.child_guardians
  for each row execute function public.set_updated_at();
