-- ============================================================
-- Migration 012: multi-dimensional SNA ontology
--   * sna_entities: non-person nodes (space/skill/food/achievement/ecosystem)
--   * interactions.label: human-readable edge label
--   * validate_interaction_node_refs: validate every node kind
--   * get_sna_graph: emit all node kinds + status + typed labeled edges
--   * get_sna_insights: add allergy / health-alert findings
-- Idempotent.
-- ============================================================

-- 1. Edge label (carries the rich relation text e.g. '단짝', '밀접 접촉')
alter table public.interactions
  add column if not exists label text;

-- 2. Non-person ontology nodes
create table if not exists public.sna_entities (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  kind public.node_kind not null,
  name text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sna_entities_kind_chk
    check (kind in ('space','skill','food','achievement','ecosystem'))
);
create index if not exists idx_sna_entities_center on public.sna_entities(center_id) where deleted_at is null;
create index if not exists idx_sna_entities_kind on public.sna_entities(center_id, kind) where deleted_at is null;

alter table public.sna_entities enable row level security;
drop policy if exists sna_entities_sel on public.sna_entities;
drop policy if exists sna_entities_ins on public.sna_entities;
drop policy if exists sna_entities_upd on public.sna_entities;
drop policy if exists sna_entities_del on public.sna_entities;
create policy sna_entities_sel on public.sna_entities for select to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null);
create policy sna_entities_ins on public.sna_entities for insert to authenticated
  with check (center_id = public.current_user_center_id());
create policy sna_entities_upd on public.sna_entities for update to authenticated
  using (center_id = public.current_user_center_id()) with check (center_id = public.current_user_center_id());
create policy sna_entities_del on public.sna_entities for delete to authenticated
  using (center_id = public.current_user_center_id());

drop trigger if exists set_sna_entities_updated_at on public.sna_entities;
create trigger set_sna_entities_updated_at before update on public.sna_entities
  for each row execute function public.set_updated_at();

-- 3. Validate interaction node refs for every node kind
create or replace function public.validate_interaction_node_refs()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare ok boolean;
begin
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
end; $$;

-- 4. Multi-dimensional read model
create or replace function public.get_sna_graph(p_center_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp as $$
  with active_children as (
    select c.id, c.name, c.class_id, cl.name as class_name
    from children c left join classes cl on cl.id=c.class_id and cl.deleted_at is null
    where c.center_id=p_center_id and c.status='active' and c.deleted_at is null
  ),
  latest_metrics as (
    select distinct on (child_id) child_id, betweenness, closeness, eigenvector,
      community_id, is_isolated, degree
    from sna_metrics where center_id=p_center_id order by child_id, computed_at desc
  ),
  raw_edges as (
    select i.source_id::text s, i.target_id::text t, i.relation_type::text relation_type,
      coalesce(i.label,'') as label, i.weight, coalesce(i.is_directed,false) is_directed
    from interactions i
    where i.center_id=p_center_id and i.deleted_at is null
      and i.weight is not null and i.weight>0 and i.source_id <> i.target_id
  ),
  edges as (
    select s as source_id, t as target_id, relation_type,
      nullif(max(label),'') as label, sum(weight) as strength,
      bool_or(relation_type='conflict') as has_conflict, bool_and(is_directed) as is_directed
    from raw_edges group by s, t, relation_type
  ),
  edge_nodes as (select source_id id from edges union select target_id from edges),
  degree as (
    select id, count(*) deg from (
      select source_id id from edges union all select target_id from edges
    ) u group by id
  ),
  child_health as (
    select ac.id,
      case
        when exists(select 1 from care_notes cn where cn.child_id=ac.id and cn.deleted_at is null and cn.note_type='health' and cn.content ilike '%확진%') then 'confirmed'
        when exists(select 1 from care_notes cn where cn.child_id=ac.id and cn.deleted_at is null and cn.note_type='health' and cn.content ilike '%고위험%') then 'highrisk'
        when exists(select 1 from care_notes cn where cn.child_id=ac.id and cn.deleted_at is null and cn.note_type='health' and (cn.content ilike '%관찰%' or cn.content ilike '%주의%')) then 'watch'
        else 'normal' end as health_status,
      exists(select 1 from health_profiles hp where hp.child_id=ac.id and hp.deleted_at is null and coalesce(trim(hp.allergies),'')<>'') as has_allergy
    from active_children ac
  ),
  staff_nodes as (
    select s.id, s.name, s.role::text as role,
      (select cl.id from classes cl where cl.homeroom_staff_id=s.id and cl.deleted_at is null limit 1) as class_id,
      (select cl.name from classes cl where cl.homeroom_staff_id=s.id and cl.deleted_at is null limit 1) as class_name
    from staff_profiles s where s.center_id=p_center_id and s.deleted_at is null
  ),
  guardian_nodes as (
    select g.id, g.guardian_name as name from guardian_profiles g
    where g.center_id=p_center_id and g.deleted_at is null and g.id::text in (select id from edge_nodes)
  ),
  entity_nodes as (
    select e.id, e.kind::text as kind, e.name, e.meta from sna_entities e
    where e.center_id=p_center_id and e.deleted_at is null and e.id::text in (select id from edge_nodes)
  )
  select jsonb_build_object(
    'nodes', (
      select coalesce(jsonb_agg(n),'[]'::jsonb) from (
        select jsonb_build_object('id',ac.id,'kind','child','name',ac.name,'class_id',ac.class_id,'class_name',ac.class_name,
          'group', case when ch.health_status='confirmed' then 'child_sick'
                        when ch.health_status='highrisk' then 'child_highrisk'
                        when coalesce(lm.is_isolated,true) then 'child_isolated'
                        else 'child_active' end,
          'connection_count', coalesce(d.deg, lm.degree, 0),
          'betweenness', round(coalesce(lm.betweenness,0)::numeric,4),
          'eigenvector', round(coalesce(lm.eigenvector,0)::numeric,4),
          'closeness', round(coalesce(lm.closeness,0)::numeric,4),
          'community_id', lm.community_id,
          'is_isolated', coalesce(lm.is_isolated, d.deg is null),
          'health_status', ch.health_status, 'has_allergy', ch.has_allergy) as n
        from active_children ac
        left join latest_metrics lm on lm.child_id=ac.id
        left join child_health ch on ch.id=ac.id
        left join degree d on d.id=ac.id::text
        union all
        select jsonb_build_object('id',sn.id,'kind','staff','name',sn.name,'class_id',sn.class_id,'class_name',sn.class_name,
          'group', case when sn.role='director' then 'director' else 'teacher' end,
          'connection_count', coalesce(d.deg,0),'betweenness',0,'eigenvector',0,'closeness',0,
          'community_id',null,'is_isolated',false,'health_status','normal','has_allergy',false)
        from staff_nodes sn left join degree d on d.id=sn.id::text
        union all
        select jsonb_build_object('id',gn.id,'kind','guardian','name',gn.name,'class_id',null,'class_name',null,
          'group','guardian','connection_count',coalesce(d.deg,0),'betweenness',0,'eigenvector',0,'closeness',0,
          'community_id',null,'is_isolated',false,'health_status','normal','has_allergy',false)
        from guardian_nodes gn left join degree d on d.id=gn.id::text
        union all
        select jsonb_build_object('id',en.id,'kind',en.kind,'name',en.name,'class_id',null,'class_name',null,
          'group',en.kind,'connection_count',coalesce(d.deg,0),'betweenness',0,'eigenvector',0,'closeness',0,
          'community_id',null,'is_isolated',false,'health_status','normal','has_allergy',false,'meta',en.meta)
        from entity_nodes en left join degree d on d.id=en.id::text
      ) q
    ),
    'edges', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', md5(source_id||'|'||target_id||'|'||relation_type||'|'||coalesce(label,'')),
        'source_id',source_id,'target_id',target_id,'relation_type',relation_type,
        'label',label,'strength',round(strength::numeric,3),'has_conflict',has_conflict,'is_directed',is_directed)),'[]'::jsonb)
      from edges
    )
  );
$$;

-- 5. Insights: keep existing findings, add allergy + health alerts + entity tally
create or replace function public.get_sna_insights(p_center_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp as $$
  with m as (
    select distinct on (s.child_id)
      s.child_id, c.name, c.class_id, cl.name as class_name,
      s.betweenness, s.eigenvector, s.closeness, s.community_id,
      s.degree, s.in_degree, s.out_degree, s.is_isolated, s.clustering_coeff
    from public.sna_metrics s
    join public.children c on c.id = s.child_id and c.status='active' and c.deleted_at is null
    left join public.classes cl on cl.id = c.class_id
    where s.center_id = p_center_id
    order by s.child_id, s.computed_at desc
  ),
  conflict_pairs as (
    select i.source_id, i.target_id from public.interactions i
    where i.center_id=p_center_id and i.deleted_at is null and i.relation_type='conflict'
      and i.source_kind='child' and i.target_kind='child'
  ),
  cross_class_edges as (
    select count(*) as n from public.interactions i
    join public.children s on s.id=i.source_id join public.children t on t.id=i.target_id
    where i.center_id=p_center_id and i.deleted_at is null
      and i.source_kind='child' and i.target_kind='child' and s.class_id is distinct from t.class_id
  )
  select jsonb_build_object(
    'isolated', coalesce((select jsonb_agg(jsonb_build_object('child_id',child_id,'name',name,'class_name',class_name)) from m where is_isolated or degree=0), '[]'::jsonb),
    'top_brokers', coalesce((select jsonb_agg(jsonb_build_object('child_id',child_id,'name',name,'betweenness',round(betweenness::numeric,4))) from (select * from m where betweenness>0 order by betweenness desc limit 5) q), '[]'::jsonb),
    'most_influential', coalesce((select jsonb_agg(jsonb_build_object('child_id',child_id,'name',name,'eigenvector',round(eigenvector::numeric,4))) from (select * from m where eigenvector>0 order by eigenvector desc limit 5) q), '[]'::jsonb),
    'conflict_children', coalesce((select jsonb_agg(jsonb_build_object('child_id',child_id,'name',name,'conflicts',n)) from (select c.id child_id, c.name, count(*) n from conflict_pairs cp join public.children c on c.id in (cp.source_id, cp.target_id) where c.center_id=p_center_id group by c.id, c.name order by n desc limit 5) q), '[]'::jsonb),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('community_id',community_id,'size',cnt,'members',members)) from (select community_id, count(*) cnt, jsonb_agg(name order by name) members from m where community_id is not null group by community_id order by cnt desc) q), '[]'::jsonb),
    'allergy_children', coalesce((select jsonb_agg(jsonb_build_object('child_id',c.id,'name',c.name,'allergies',hp.allergies)) from public.children c join public.health_profiles hp on hp.child_id=c.id and hp.deleted_at is null where c.center_id=p_center_id and c.status='active' and c.deleted_at is null and coalesce(trim(hp.allergies),'')<>''), '[]'::jsonb),
    'health_alerts', coalesce((select jsonb_agg(jsonb_build_object('child_id',c.id,'name',c.name,'note',cn.content,'level', case when cn.content ilike '%확진%' then 'confirmed' when cn.content ilike '%고위험%' then 'highrisk' else 'watch' end)) from public.children c join lateral (select content from public.care_notes x where x.child_id=c.id and x.deleted_at is null and x.note_type='health' order by x.noted_on desc nulls last limit 1) cn on true where c.center_id=p_center_id and c.status='active' and c.deleted_at is null and (cn.content ilike '%확진%' or cn.content ilike '%고위험%' or cn.content ilike '%관찰%' or cn.content ilike '%주의%')), '[]'::jsonb),
    'cross_class_links', (select n from cross_class_edges),
    'entities', coalesce((select jsonb_object_agg(kind, cnt) from (select kind::text, count(*) cnt from public.sna_entities where center_id=p_center_id and deleted_at is null group by kind) q), '{}'::jsonb),
    'summary', (select jsonb_build_object('children',count(*),'isolated',count(*) filter (where is_isolated or degree=0),'avg_betweenness',round(coalesce(avg(betweenness),0)::numeric,4),'communities',count(distinct community_id) filter (where community_id is not null)) from m)
  );
$$;

revoke all on function public.get_sna_insights(uuid) from public;
grant execute on function public.get_sna_insights(uuid) to authenticated, service_role;
