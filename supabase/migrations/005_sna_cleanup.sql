-- ============================================================
-- LUMIX Pro - Migration 005: SNA pipeline cleanup & hardening
-- ============================================================

-- 1. Drop the second fragile per-row HTTP trigger (on label rules)
--    and the now-unused trigger function. Recompute is explicit.
drop trigger if exists trg_call_recompute_sna_brandes_label_rules on public.sna_label_rules;
drop trigger if exists trg_call_recompute_sna_brandes_interactions on public.interactions;
drop function if exists public.call_recompute_sna_brandes();

-- 2. rebuild_sna_edges is SECURITY DEFINER and only ever invoked
--    server-side by the edge functions (service role). Remove it from
--    the public REST surface so anon/authenticated cannot call it.
revoke execute on function public.rebuild_sna_edges(uuid) from anon, authenticated;
grant execute on function public.rebuild_sna_edges(uuid) to service_role;
