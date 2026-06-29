-- ============================================================
-- 024 — enable realtime change feed for the children table (H6)
-- ------------------------------------------------------------
-- List views subscribe via lib/useRealtimeRefresh so edits made elsewhere
-- appear without a manual reload. The table must be a member of the
-- supabase_realtime publication for change events to be delivered.
-- ============================================================
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='children'
  ) then
    alter publication supabase_realtime add table public.children;
  end if;
end $$;
