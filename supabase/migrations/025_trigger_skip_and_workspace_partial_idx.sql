-- ============================================================
-- 025 — interaction-validation fast paths + workspace partial index
-- ------------------------------------------------------------
-- M4: validate_interaction_node_refs ran its per-row EXISTS checks on every
--     UPDATE (even soft-deletes / weight tweaks that don't touch node refs)
--     and on trusted bulk rebuilds. Add an UPDATE short-circuit when refs are
--     unchanged, plus a `lumix.skip_node_validation='on'` session opt-out for
--     trusted bulk paths. (The EXISTS checks themselves are PK-index-backed.)
-- M12: workspace_memos' center index now excludes soft-deleted rows
--     (WHERE deleted_at IS NULL). workspace_snapshots hard-deletes, so it has
--     no deleted_at column and needs no partial index.
-- ============================================================
create or replace function public.validate_interaction_node_refs()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare ok boolean;
begin
  if coalesce(current_setting('lumix.skip_node_validation', true), '') = 'on' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE'
     and NEW.center_id = OLD.center_id
     and NEW.source_kind = OLD.source_kind and NEW.source_id = OLD.source_id
     and NEW.target_kind = OLD.target_kind and NEW.target_id = OLD.target_id then
    return NEW;
  end if;

  if NEW.source_kind = 'child' then
    select exists(select 1 from children c where c.id=NEW.source_id and c.center_id=NEW.center_id and c.deleted_at is null) into ok;
  elsif NEW.source_kind = 'staff' then
    select exists(select 1 from staff_profiles s where s.id=NEW.source_id and s.center_id=NEW.center_id and s.deleted_at is null) into ok;
  elsif NEW.source_kind = 'guardian' then
    select exists(select 1 from guardian_profiles g where g.id=NEW.source_id and g.center_id=NEW.center_id and g.deleted_at is null) into ok;
  else
    select exists(select 1 from sna_entities e where e.id=NEW.source_id and e.center_id=NEW.center_id and e.deleted_at is null and e.kind=NEW.source_kind) into ok;
  end if;
  if not ok then raise exception 'Invalid interactions.source_id for kind %', NEW.source_kind; end if;

  if NEW.target_kind = 'child' then
    select exists(select 1 from children c where c.id=NEW.target_id and c.center_id=NEW.center_id and c.deleted_at is null) into ok;
  elsif NEW.target_kind = 'staff' then
    select exists(select 1 from staff_profiles s where s.id=NEW.target_id and s.center_id=NEW.center_id and s.deleted_at is null) into ok;
  elsif NEW.target_kind = 'guardian' then
    select exists(select 1 from guardian_profiles g where g.id=NEW.target_id and g.center_id=NEW.center_id and g.deleted_at is null) into ok;
  else
    select exists(select 1 from sna_entities e where e.id=NEW.target_id and e.center_id=NEW.center_id and e.deleted_at is null and e.kind=NEW.target_kind) into ok;
  end if;
  if not ok then raise exception 'Invalid interactions.target_id for kind %', NEW.target_kind; end if;

  return NEW;
end; $function$;

drop index if exists public.workspace_memos_center_idx;
create index workspace_memos_center_idx
  on public.workspace_memos (center_id, created_at desc) where deleted_at is null;

-- ── rollback (M9) ───────────────────────────────────────────────────────────
-- drop index if exists public.workspace_memos_center_idx;
-- create index workspace_memos_center_idx on public.workspace_memos (center_id, created_at desc);
-- (restore the prior validate_interaction_node_refs body from migration 012)
