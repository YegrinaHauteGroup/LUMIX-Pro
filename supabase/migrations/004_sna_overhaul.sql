-- ============================================================
-- LUMIX Pro - Migration 004: SNA pipeline overhaul
-- ------------------------------------------------------------
-- Fixes:
--   * sna_metrics had no unique key -> edge-function ON CONFLICT
--     (center_id, child_id, period_start, period_end) always errored.
--   * Per-row http trigger on interactions hammered the Brandes
--     edge function (N calls/insert) with no auth header (401).
--   * get_sna_graph output shape did not match the frontend.
-- Adds:
--   * Richer sna_metrics columns (weighted_degree, degree_centrality,
--     community_id) for advanced centrality + community detection.
--   * Ontology-driven read model get_sna_graph + get_sna_insights.
--   * rebuild_sna_edges() SQL helper (pure-SQL ontology mapping).
--   * Guardian -> child ontology rules.
-- Idempotent: safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. sna_metrics: add advanced columns + a real upsert key
-- ------------------------------------------------------------
alter table public.sna_metrics
  add column if not exists weighted_degree   numeric,
  add column if not exists degree_centrality numeric,
  add column if not exists community_id      integer;

-- Normalise any legacy rows that used NULL periods so the snapshot
-- key below is consistent (period_start = period_end = a date).
update public.sna_metrics
   set period_start = coalesce(period_start, computed_at::date, current_date),
       period_end   = coalesce(period_end,   computed_at::date, current_date)
 where period_start is null or period_end is null;

-- One snapshot per (center, child, period). NULLS NOT DISTINCT (PG15+)
-- guarantees the ON CONFLICT target resolves even if a period is null.
create unique index if not exists uq_sna_metrics_snapshot
  on public.sna_metrics (center_id, child_id, period_start, period_end)
  nulls not distinct;

-- ------------------------------------------------------------
-- 2. Remove the fragile per-row HTTP trigger.
--    Recompute is now driven explicitly (app button / cron),
--    which avoids the N-calls-per-insert + 401 storm.
-- ------------------------------------------------------------
drop trigger if exists trg_call_recompute_sna_brandes_interactions on public.interactions;

-- ------------------------------------------------------------
-- 3. Performance indexes for the interaction graph
-- ------------------------------------------------------------
create index if not exists idx_interactions_center_live
  on public.interactions (center_id)
  where deleted_at is null;

create index if not exists idx_interactions_child_pair
  on public.interactions (center_id, source_kind, target_kind)
  where deleted_at is null;

create index if not exists idx_interactions_auto_note
  on public.interactions (center_id, note)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 4. Guardian -> child ontology rules (were missing).
--    sna_label_rules_range_no_overlap unique:
--    (center_id, source_kind, target_kind, dimension, score_min, score_max, relation_type)
-- ------------------------------------------------------------
insert into public.sna_label_rules
  (center_id, active, source_kind, target_kind, dimension, score_min, score_max, relation_type, weight, is_directed)
values
  (null, true, 'guardian', 'child', 'communication',   1,  100, 'communication', 0.7, false),
  (null, true, 'guardian', 'child', 'self_help',        1,  100, 'caregiving',    0.7, false),
  (null, true, 'guardian', 'child', 'behavior',      -100,   -1, 'conflict',      0.8, false),
  (null, true, 'child',    'child', 'learning',         1,  100, 'help_seeking',  0.7, true),
  (null, true, 'child',    'child', 'self_help',        1,  100, 'proximity',     0.6, false)
on conflict (center_id, source_kind, target_kind, dimension, score_min, score_max, relation_type)
do nothing;

-- ============================================================
-- 5. rebuild_sna_edges(center_id): regenerate ontology edges
--    from assessment tables (pure SQL, transactional).
--    Generated edges are tagged note like 'auto:%'.
-- ============================================================
create or replace function public.rebuild_sna_edges(p_center_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
  v_inserted integer := 0;
begin
  -- 0) wipe previously generated edges for this center
  delete from public.interactions
   where center_id = p_center_id
     and note like 'auto:%';
  get diagnostics v_deleted = row_count;

  -- shared rule resolver: prefer center-specific over global, narrowest range
  with rules as (
    select * from public.sna_label_rules where active
  ),

  -- 1) peer -> child<->child
  peer_edges as (
    select distinct on (p.center_id, p.from_child_id, p.to_child_id, p.dimension)
      p.center_id,
      r.source_kind, p.from_child_id as src, r.target_kind, p.to_child_id as tgt,
      r.relation_type, r.weight, r.is_directed, p.dimension,
      'auto:peer:'||p.dimension::text as note
    from public.peer_assessments p
    join rules r
      on r.source_kind='child' and r.target_kind='child'
     and r.dimension = p.dimension
     and p.score between r.score_min and r.score_max
     and (r.center_id = p.center_id or r.center_id is null)
    where p.center_id = p_center_id and p.deleted_at is null
    order by p.center_id, p.from_child_id, p.to_child_id, p.dimension,
             (r.center_id = p.center_id) desc, (r.score_max - r.score_min) asc
  ),

  -- 2) staff -> child
  staff_edges as (
    select distinct on (s.center_id, s.staff_id, s.child_id, s.dimension)
      s.center_id,
      r.source_kind, s.staff_id as src, r.target_kind, s.child_id as tgt,
      r.relation_type, r.weight, r.is_directed, s.dimension,
      'auto:staff:'||s.dimension::text as note
    from public.staff_child_assessments s
    join rules r
      on r.source_kind='staff' and r.target_kind='child'
     and r.dimension = s.dimension
     and s.score between r.score_min and r.score_max
     and (r.center_id = s.center_id or r.center_id is null)
    where s.center_id = p_center_id and s.deleted_at is null
    order by s.center_id, s.staff_id, s.child_id, s.dimension,
             (r.center_id = s.center_id) desc, (r.score_max - r.score_min) asc
  ),

  -- 3) guardian -> child (uses guardian_profile_id as node id)
  guardian_edges as (
    select distinct on (g.center_id, g.guardian_profile_id, g.child_id, g.dimension)
      g.center_id,
      r.source_kind, g.guardian_profile_id as src, r.target_kind, g.child_id as tgt,
      r.relation_type, r.weight, r.is_directed, g.dimension,
      'auto:guardian:'||g.dimension::text as note
    from public.guardian_child_assessments g
    join rules r
      on r.source_kind='guardian' and r.target_kind='child'
     and r.dimension = g.dimension
     and g.score between r.score_min and r.score_max
     and (r.center_id = g.center_id or r.center_id is null)
    where g.center_id = p_center_id and g.deleted_at is null
      and g.guardian_profile_id is not null
    order by g.center_id, g.guardian_profile_id, g.child_id, g.dimension,
             (r.center_id = g.center_id) desc, (r.score_max - r.score_min) asc
  ),

  all_edges as (
    select * from peer_edges
    union all select * from staff_edges
    union all select * from guardian_edges
  ),

  -- normalise undirected child<->child edges to a canonical orientation
  normalised as (
    select
      center_id,
      case when not is_directed and source_kind=target_kind and src > tgt then target_kind else source_kind end as source_kind,
      case when not is_directed and source_kind=target_kind and src > tgt then tgt else src end as source_id,
      case when not is_directed and source_kind=target_kind and src > tgt then source_kind else target_kind end as target_kind,
      case when not is_directed and source_kind=target_kind and src > tgt then src else tgt end as target_id,
      relation_type, weight, is_directed, note
    from all_edges
  ),
  ins as (
    insert into public.interactions
      (center_id, source_kind, source_id, target_kind, target_id,
       relation_type, weight, is_directed, occurred_at, note)
    select center_id, source_kind::node_kind, source_id, target_kind::node_kind, target_id,
           relation_type::relation_type, weight, is_directed, now(), note
    from normalised
    returning 1
  )
  select count(*) into v_inserted from ins;

  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'inserted', v_inserted);
end;
$$;

revoke all on function public.rebuild_sna_edges(uuid) from public;
grant execute on function public.rebuild_sna_edges(uuid) to authenticated, service_role;

-- ============================================================
-- 6. get_sna_graph(center_id): ontology-aware read model
--    Output is backward compatible (child_id/class_id/
--    connection_count + source_id/target_id/strength) and adds
--    advanced centrality + community + relation semantics.
-- ============================================================
create or replace function public.get_sna_graph(p_center_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with active_children as (
    select c.id, c.name, c.class_id, cl.name as class_name
    from public.children c
    left join public.classes cl
      on cl.id = c.class_id and cl.deleted_at is null
    where c.center_id = p_center_id
      and c.status = 'active'
      and c.deleted_at is null
  ),
  -- collapse child<->child interactions into one undirected pair
  pair_edges as (
    select
      least(i.source_id, i.target_id)  as a,
      greatest(i.source_id, i.target_id) as b,
      sum(i.weight)                    as strength,
      array_agg(distinct i.relation_type::text) as relation_types,
      bool_or(i.relation_type = 'conflict') as has_conflict
    from public.interactions i
    where i.center_id = p_center_id
      and i.deleted_at is null
      and i.source_kind = 'child'
      and i.target_kind = 'child'
      and i.weight is not null
      and i.weight > 0
      and i.source_id <> i.target_id
    group by least(i.source_id, i.target_id), greatest(i.source_id, i.target_id)
  ),
  edges as (
    select pe.*
    from pair_edges pe
    where pe.a in (select id from active_children)
      and pe.b in (select id from active_children)
  ),
  degree as (
    select id, count(*) as deg, coalesce(sum(strength), 0) as wdeg
    from (
      select a as id, strength from edges
      union all
      select b as id, strength from edges
    ) u
    group by id
  ),
  latest_metrics as (
    select distinct on (child_id)
      child_id, weighted_degree, in_degree, out_degree,
      betweenness, closeness, eigenvector, clustering_coeff,
      community_id, is_isolated, degree_centrality
    from public.sna_metrics
    where center_id = p_center_id
    order by child_id, computed_at desc
  )
  select jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'child_id',         ac.id,
        'name',             ac.name,
        'class_id',         ac.class_id,
        'class_name',       ac.class_name,
        'connection_count', coalesce(d.deg, 0),
        'weighted_degree',  round(coalesce(lm.weighted_degree, d.wdeg, 0)::numeric, 3),
        'in_degree',        coalesce(lm.in_degree, 0),
        'out_degree',       coalesce(lm.out_degree, 0),
        'betweenness',      round(coalesce(lm.betweenness, 0)::numeric, 4),
        'closeness',        round(coalesce(lm.closeness, 0)::numeric, 4),
        'eigenvector',      round(coalesce(lm.eigenvector, 0)::numeric, 4),
        'clustering',       round(coalesce(lm.clustering_coeff, 0)::numeric, 4),
        'degree_centrality',round(coalesce(lm.degree_centrality, 0)::numeric, 4),
        'community_id',     lm.community_id,
        'is_isolated',      coalesce(lm.is_isolated, d.deg is null)
      ))
      from active_children ac
      left join degree d on d.id = ac.id
      left join latest_metrics lm on lm.child_id = ac.id
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_id',      a,
        'target_id',      b,
        'strength',       round(strength::numeric, 3),
        'relation_types', to_jsonb(relation_types),
        'has_conflict',   has_conflict
      ))
      from edges
    ), '[]'::jsonb)
  );
$$;

-- ============================================================
-- 7. get_sna_insights(center_id): ontology-driven findings
--    Surfaces patterns a human would struggle to spot:
--    isolated children, brokers (betweenness), influential
--    children (eigenvector), conflict hotspots, cross-class
--    bridges, communities, and reciprocity gaps.
-- ============================================================
create or replace function public.get_sna_insights(p_center_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with m as (
    select distinct on (s.child_id)
      s.child_id, c.name, c.class_id, cl.name as class_name,
      s.betweenness, s.eigenvector, s.closeness, s.community_id,
      s.degree, s.in_degree, s.out_degree, s.is_isolated, s.clustering_coeff
    from public.sna_metrics s
    join public.children c
      on c.id = s.child_id and c.status='active' and c.deleted_at is null
    left join public.classes cl on cl.id = c.class_id
    where s.center_id = p_center_id
    order by s.child_id, s.computed_at desc
  ),
  conflict_pairs as (
    select i.source_id, i.target_id, i.weight
    from public.interactions i
    where i.center_id = p_center_id
      and i.deleted_at is null
      and i.relation_type = 'conflict'
      and i.source_kind = 'child' and i.target_kind = 'child'
  ),
  cross_class_edges as (
    select count(*) as n
    from public.interactions i
    join public.children s on s.id = i.source_id
    join public.children t on t.id = i.target_id
    where i.center_id = p_center_id and i.deleted_at is null
      and i.source_kind='child' and i.target_kind='child'
      and s.class_id is distinct from t.class_id
  )
  select jsonb_build_object(
    'isolated', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', child_id, 'name', name, 'class_name', class_name))
      from m where is_isolated or degree = 0
    ), '[]'::jsonb),
    'top_brokers', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', child_id, 'name', name, 'betweenness', round(betweenness::numeric,4)))
      from (select * from m where betweenness > 0 order by betweenness desc limit 5) q
    ), '[]'::jsonb),
    'most_influential', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', child_id, 'name', name, 'eigenvector', round(eigenvector::numeric,4)))
      from (select * from m where eigenvector > 0 order by eigenvector desc limit 5) q
    ), '[]'::jsonb),
    'conflict_children', coalesce((
      select jsonb_agg(jsonb_build_object('child_id', child_id, 'name', name, 'conflicts', n))
      from (
        select c.id as child_id, c.name, count(*) as n
        from conflict_pairs cp
        join public.children c on c.id in (cp.source_id, cp.target_id)
        where c.center_id = p_center_id
        group by c.id, c.name
        order by n desc limit 5
      ) q
    ), '[]'::jsonb),
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object('community_id', community_id, 'size', cnt, 'members', members))
      from (
        select community_id, count(*) cnt, jsonb_agg(name order by name) members
        from m where community_id is not null
        group by community_id order by cnt desc
      ) q
    ), '[]'::jsonb),
    'cross_class_links', (select n from cross_class_edges),
    'summary', (
      select jsonb_build_object(
        'children', count(*),
        'isolated', count(*) filter (where is_isolated or degree = 0),
        'avg_betweenness', round(coalesce(avg(betweenness),0)::numeric,4),
        'communities', count(distinct community_id) filter (where community_id is not null)
      ) from m
    )
  );
$$;

revoke all on function public.get_sna_insights(uuid) from public;
grant execute on function public.get_sna_insights(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 8. Harden previously-flagged function search paths
-- ------------------------------------------------------------
alter function public.set_updated_at()                       set search_path = public, pg_temp;
alter function public.validate_interaction_node_refs()        set search_path = public, pg_temp;
