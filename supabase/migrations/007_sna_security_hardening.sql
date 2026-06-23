-- ============================================================
-- LUMIX Pro - Migration 007: security hardening
--   * SNA edge views -> security_invoker (advisor ERROR fix)
--   * remaining functions get a fixed search_path
-- ============================================================

alter view public.v_child_interaction_edges set (security_invoker = on);
alter view public.v_child_interaction_edges_dedup set (security_invoker = on);

alter function public.validate_child_center_id_match() set search_path = public, pg_temp;
alter function public.forbid_audit_logs_update_delete() set search_path = public, pg_temp;
