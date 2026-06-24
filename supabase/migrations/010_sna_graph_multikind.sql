-- ============================================================
-- Migration 010: get_sna_graph -> multi-kind ontology graph
-- Returns children + staff + guardians as distinct nodes with typed,
-- aggregated edges, plus per-child centrality metrics. Drives the
-- multi-dimensional SNA visualization.
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
    left join public.classes cl on cl.id = c.class_id and cl.deleted_at is null
    where c.center_id = p_center_id and c.status = 'active' and c.deleted_at is null
  ),
  latest_metrics as (
    select distinct on (child_id)
      child_id, weighted_degree, in_degree, out_degree, betweenness, closeness,
      eigenvector, clustering_coeff, community_id, is_isolated, degree_centrality, degree
    from public.sna_metrics
    where center_id = p_center_id
    order by child_id, computed_at desc
  ),
  raw_edges as (
    select i.source_id::text as s, i.target_id::text as t,
      i.relation_type::text as relation_type,
      i.weight, coalesce(i.is_directed,false) as is_directed
    from public.interactions i
    where i.center_id = p_center_id and i.deleted_at is null
      and i.weight is not null and i.weight > 0 and i.source_id <> i.target_id
  ),
  edges as (
    select s as source_id, t as target_id, max(relation_type) as relation_type,
      sum(weight) as strength, bool_or(relation_type = 'conflict') as has_conflict,
      bool_and(is_directed) as is_directed
    from raw_edges group by s, t
  ),
  edge_nodes as (select source_id as id from edges union select target_id as id from edges),
  staff_nodes as (
    select s.id, s.name from public.staff_profiles s
    where s.center_id = p_center_id and s.deleted_at is null and s.id::text in (select id from edge_nodes)
  ),
  guardian_nodes as (
    select g.id, g.guardian_name as name from public.guardian_profiles g
    where g.center_id = p_center_id and g.deleted_at is null and g.id::text in (select id from edge_nodes)
  )
  select jsonb_build_object(
    'nodes', (
      select coalesce(jsonb_agg(n), '[]'::jsonb) from (
        select jsonb_build_object('id', ac.id, 'kind', 'child', 'name', ac.name,
          'class_id', ac.class_id, 'class_name', ac.class_name,
          'connection_count', coalesce(lm.degree, 0),
          'betweenness', round(coalesce(lm.betweenness,0)::numeric,4),
          'eigenvector', round(coalesce(lm.eigenvector,0)::numeric,4),
          'closeness', round(coalesce(lm.closeness,0)::numeric,4),
          'community_id', lm.community_id, 'is_isolated', coalesce(lm.is_isolated, true)) as n
        from active_children ac left join latest_metrics lm on lm.child_id = ac.id
        union all
        select jsonb_build_object('id', sn.id, 'kind', 'staff', 'name', sn.name, 'class_id', null,
          'class_name', null, 'connection_count', 0, 'betweenness', 0, 'eigenvector', 0,
          'closeness', 0, 'community_id', null, 'is_isolated', false) from staff_nodes sn
        union all
        select jsonb_build_object('id', gn.id, 'kind', 'guardian', 'name', gn.name, 'class_id', null,
          'class_name', null, 'connection_count', 0, 'betweenness', 0, 'eigenvector', 0,
          'closeness', 0, 'community_id', null, 'is_isolated', false) from guardian_nodes gn
      ) q
    ),
    'edges', (
      select coalesce(jsonb_agg(jsonb_build_object('source_id', source_id, 'target_id', target_id,
        'relation_type', relation_type, 'strength', round(strength::numeric,3),
        'has_conflict', has_conflict, 'is_directed', is_directed)), '[]'::jsonb) from edges
    )
  );
$$;
