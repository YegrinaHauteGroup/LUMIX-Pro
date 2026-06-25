-- ============================================================
-- Migration 018: real-time threat / risk detection.
-- Synthesizes SNA metrics, health/care signals, conflict edges,
-- allergy exposure, attendance anomalies, supervision gaps and the
-- location feed (air quality) into prioritized threat cards.
-- ============================================================
create or replace function public.get_threats(p_center_id uuid)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp as $$
with
  active as (select id, name, class_id from children where center_id=p_center_id and status='active' and deleted_at is null),
  lm as (select distinct on (child_id) child_id, is_isolated, betweenness, degree
         from sna_metrics where center_id=p_center_id order by child_id, computed_at desc),
  health_kids as (
    select c.id, c.name,
      case when exists(select 1 from care_notes cn where cn.child_id=c.id and cn.deleted_at is null and cn.note_type='health' and cn.content ilike '%확진%') then 'confirmed'
           when exists(select 1 from care_notes cn where cn.child_id=c.id and cn.deleted_at is null and cn.note_type='health' and cn.content ilike '%고위험%') then 'highrisk'
           else null end lvl
    from active c
  ),
  contact_n as (select count(*) n from interactions i where i.center_id=p_center_id and i.deleted_at is null and i.label ilike '%밀접 접촉%'),
  conflict_pairs as (
    select count(*) n, coalesce(to_jsonb(array_agg(distinct nm)),'[]'::jsonb) names from (
      select c.name nm from interactions i join active c on c.id in (i.source_id, i.target_id)
      where i.center_id=p_center_id and i.deleted_at is null and i.relation_type='conflict' and i.source_kind='child' and i.target_kind='child'
    ) z
  ),
  iso as (select coalesce(to_jsonb(array_agg(c.name)),'[]'::jsonb) names, count(*) n
          from active c join lm on lm.child_id=c.id where lm.is_isolated),
  allergy as (select coalesce(to_jsonb(array_agg(c.name)),'[]'::jsonb) names, count(*) n
              from active c join health_profiles hp on hp.child_id=c.id and hp.deleted_at is null
              where coalesce(trim(hp.allergies),'')<>''),
  absent as (select coalesce(to_jsonb(array_agg(name)),'[]'::jsonb) names, count(*) n from (
      select c.name from active c join attendances a on a.child_id=c.id
      where a.status='absent' and a.attendance_date >= current_date-30
      group by c.name having count(*)>=3) z),
  supervision as (select coalesce(to_jsonb(array_agg(c.name)),'[]'::jsonb) names, count(*) n
      from active c join lm on lm.child_id=c.id
      where lm.is_isolated and not exists(
        select 1 from interactions i where i.center_id=p_center_id and i.deleted_at is null
          and i.target_id=c.id and i.source_kind='staff')),
  air as (select (weather->'air'->>'pm25')::numeric pm25, weather->'air'->>'grade' grade
          from dashboard_feeds where center_id=p_center_id),
  rows as (
    select 'health' category,
      case when (select count(*) from health_kids where lvl='confirmed')>=2 then 'high'
           when exists(select 1 from health_kids where lvl is not null) then 'medium' else 'low' end severity,
      '감염성 질환 확산 위험' title,
      (select count(*) from health_kids where lvl is not null)::text||'명의 확진·고위험 아동과 '||
      (select n from contact_n)::text||'건의 밀접 접촉 경로가 감지되었습니다. 공용 공간 소독 및 보호자 예방 알림을 권장합니다.' detail,
      (select coalesce(to_jsonb(array_agg(name)),'[]'::jsonb) from health_kids where lvl is not null) subjects,
      ((select count(*) from health_kids where lvl is not null)*10 + (select n from contact_n))::int score
    where exists(select 1 from health_kids where lvl is not null)
    union all
    select 'conflict', case when (select n from conflict_pairs)>=4 then 'high' else 'medium' end,
      '또래 갈등 격화 위험',
      (select n from conflict_pairs)::text||'명의 아동이 갈등 관계에 연루되어 있습니다. 좌석·활동 동선 분리와 중재가 필요합니다.',
      (select names from conflict_pairs), ((select n from conflict_pairs)*8)::int
    where (select n from conflict_pairs)>0
    union all
    select 'isolation', case when (select n from iso)>=3 then 'high' else 'medium' end,
      '사회적 고립 위험',
      (select n from iso)::text||'명의 아동이 관계망에서 고립되어 있습니다. 또래 매칭·짝 활동으로 연결을 유도하세요.',
      (select names from iso), ((select n from iso)*7)::int
    where (select n from iso)>0
    union all
    select 'allergy','high','알레르기 노출 위험',
      (select n from allergy)::text||'명의 알레르기 관리 대상이 있습니다. 식단 분리 및 응급 대응 체계를 점검하세요.',
      (select names from allergy), ((select n from allergy)*9)::int
    where (select n from allergy)>0
    union all
    select 'attendance','medium','출결 이상 신호',
      (select n from absent)::text||'명이 최근 30일 3회 이상 결석했습니다. 가정 연계 및 사유 확인이 필요합니다.',
      (select names from absent), ((select n from absent)*6)::int
    where (select n from absent)>0
    union all
    select 'supervision','high','관찰 사각지대',
      (select n from supervision)::text||'명의 고립 아동에게 담당 교사 관찰 엣지가 없습니다. 관찰 누락이 우려됩니다.',
      (select names from supervision), ((select n from supervision)*9+5)::int
    where (select n from supervision)>0
    union all
    select 'environment', case when (select pm25 from air)>75 then 'high' else 'medium' end,
      '대기질 악화 경보',
      '현재 초미세먼지(PM2.5) '||coalesce((select pm25 from air)::text,'-')||'㎍/㎥('||coalesce((select grade from air),'-')||'). 실외 활동 자제 및 환기 관리를 권장합니다.',
      '[]'::jsonb, coalesce((select (pm25/2)::int from air),0)
    where (select pm25 from air) is not null and (select grade from air) in ('나쁨','매우 나쁨')
  )
  select jsonb_build_object(
    'threats', coalesce((select jsonb_agg(jsonb_build_object(
        'category',category,'severity',severity,'title',title,'detail',detail,'subjects',subjects,'score',score)
        order by case severity when 'high' then 0 when 'medium' then 1 else 2 end, score desc) from rows),'[]'::jsonb),
    'summary', jsonb_build_object(
        'total',(select count(*) from rows),
        'high',(select count(*) from rows where severity='high'),
        'medium',(select count(*) from rows where severity='medium'),
        'low',(select count(*) from rows where severity='low'))
  );
$$;
revoke all on function public.get_threats(uuid) from public, anon;
grant execute on function public.get_threats(uuid) to authenticated, service_role;
