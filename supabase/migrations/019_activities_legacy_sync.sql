-- ============================================================
-- Migration 019: keep legacy activities columns (activity_type,
-- occurred_on) in sync with the app-facing type / activity_date so
-- inserts that only set the new columns succeed (fixes activity add).
-- ============================================================
alter table public.activities alter column activity_type drop not null;
alter table public.activities alter column occurred_on   drop not null;
alter table public.activities alter column activity_type set default 'education';
alter table public.activities alter column occurred_on   set default current_date;

create or replace function public.sync_activity_legacy()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if NEW.type is not null then NEW.activity_type := NEW.type;
  elsif NEW.activity_type is null then NEW.activity_type := 'education'; end if;
  NEW.occurred_on := coalesce(NEW.activity_date, NEW.occurred_on, current_date);
  return NEW;
end $$;

drop trigger if exists trg_sync_activity_legacy on public.activities;
create trigger trg_sync_activity_legacy before insert or update on public.activities
  for each row execute function public.sync_activity_legacy();
