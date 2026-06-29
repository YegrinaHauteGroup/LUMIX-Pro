-- ============================================================
-- 026 — audit_logs retention (M3)
-- ------------------------------------------------------------
-- audit_logs is append-only and grows without bound. Add a prune function and
-- a daily pg_cron job that drops rows older than the retention window.
-- (dashboard_feeds is an upserted per-center cache — not append-only — so it
--  does not need retention.)
-- ============================================================
create extension if not exists pg_cron;

create or replace function public.prune_audit_logs(retain_days int default 180)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare n int;
begin
  delete from public.audit_logs where occurred_at < now() - make_interval(days => greatest(retain_days, 1));
  get diagnostics n = row_count;
  return n;
end; $$;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'prune_audit_logs_daily') then
    perform cron.schedule('prune_audit_logs_daily', '10 3 * * *', $cron$ select public.prune_audit_logs(180) $cron$);
  end if;
end $$;

-- ── rollback (M9) ───────────────────────────────────────────────────────────
-- select cron.unschedule('prune_audit_logs_daily');
-- drop function if exists public.prune_audit_logs(int);
