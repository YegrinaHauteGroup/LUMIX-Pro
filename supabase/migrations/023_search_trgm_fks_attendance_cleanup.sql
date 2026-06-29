-- ============================================================
-- 023 — search trigram indexes, referential integrity, legacy cleanup
-- ------------------------------------------------------------
-- H4: global_search() relies on `lower(col) LIKE '%term%'`. Leading-wildcard
--     LIKE cannot use a btree index, so these queries full-scan as data grows.
--     pg_trgm GIN indexes make substring LIKE index-usable.
-- H10: workspace_memos.author_staff_id, analysis_quests.created_by and
--      health_events.recorded_by_staff_id had no foreign keys — add them so
--      referential integrity is enforced (ON DELETE SET NULL keeps history).
-- C5: drop the empty legacy `attendance` table (the app uses `attendances`;
--     audit triggers and all code target the plural table).
--
-- Note on C1: the core tables (children/classes/activities/centers) are
-- already center-scoped via current_user_center_id() — the permissive
-- `using(true)` policies from migrations 001–002 were replaced by the later
-- security-hardening migration, so no change is needed here.
-- ============================================================

-- ── H4 ──────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

create index if not exists idx_children_name_trgm     on public.children          using gin (lower(name) gin_trgm_ops);
create index if not exists idx_classes_name_trgm      on public.classes           using gin (lower(name) gin_trgm_ops);
create index if not exists idx_activities_title_trgm  on public.activities        using gin (lower(title) gin_trgm_ops);
create index if not exists idx_staff_name_trgm        on public.staff_profiles    using gin (lower(name) gin_trgm_ops);
create index if not exists idx_guardian_name_trgm     on public.guardian_profiles using gin (lower(guardian_name) gin_trgm_ops);
create index if not exists idx_sna_entities_name_trgm on public.sna_entities      using gin (lower(name) gin_trgm_ops);
create index if not exists idx_quests_title_trgm      on public.analysis_quests   using gin (lower(title) gin_trgm_ops);
create index if not exists idx_care_notes_content_trgm on public.care_notes       using gin (lower(content) gin_trgm_ops);

-- ── H10 ─────────────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='workspace_memos_author_staff_fk') then
    alter table public.workspace_memos
      add constraint workspace_memos_author_staff_fk
      foreign key (author_staff_id) references public.staff_profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='analysis_quests_created_by_fk') then
    alter table public.analysis_quests
      add constraint analysis_quests_created_by_fk
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='health_events_recorded_by_fk') then
    alter table public.health_events
      add constraint health_events_recorded_by_fk
      foreign key (recorded_by_staff_id) references public.staff_profiles(id) on delete set null;
  end if;
end $$;

-- ── C5 ──────────────────────────────────────────────────────────────────────
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='attendance')
     and (select count(*) from public.attendance) = 0 then
    drop table public.attendance;
  end if;
end $$;
