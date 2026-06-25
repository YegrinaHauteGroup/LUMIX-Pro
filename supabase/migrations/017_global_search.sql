-- ============================================================
-- Migration 017: global omni-search across the center's data.
-- Returns a unified result set (children, classes, activities, staff,
-- guardians, SNA nodes, quests, care records) for the header search.
-- Center is resolved from the caller via current_user_center_id().
-- ============================================================
create or replace function public.global_search(p_q text)
returns jsonb language sql stable security invoker
set search_path = public, pg_temp as $$
  with c as (select public.current_user_center_id() cid),
       q as (select '%'||lower(trim(p_q))||'%' as pat)
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    (select jsonb_build_object('kind','아동','id',ch.id,'label',ch.name,
      'sublabel', coalesce(cl.name,'반 미배정'),'href','/children/'||ch.id) r
    from children ch left join classes cl on cl.id=ch.class_id, q, c
    where ch.center_id=c.cid and ch.deleted_at is null and lower(ch.name) like q.pat limit 8)
    union all
    (select jsonb_build_object('kind','반','id',cls.id,'label',cls.name,
      'sublabel',coalesce(cls.age_group,''),'href','/classes')
    from classes cls, q, c where cls.center_id=c.cid and cls.deleted_at is null and lower(cls.name) like q.pat limit 5)
    union all
    (select jsonb_build_object('kind','활동','id',a.id,'label',a.title,
      'sublabel',coalesce(a.type,''),'href','/activities')
    from activities a, q, c where a.center_id=c.cid and a.deleted_at is null and lower(a.title) like q.pat limit 6)
    union all
    (select jsonb_build_object('kind','교직원','id',s.id,'label',s.name,
      'sublabel',s.role::text,'href','/assessments')
    from staff_profiles s, q, c where s.center_id=c.cid and s.deleted_at is null and lower(s.name) like q.pat limit 5)
    union all
    (select jsonb_build_object('kind','보호자','id',g.id,'label',g.guardian_name,
      'sublabel',coalesce(g.guardian_phone,''),'href','/children')
    from guardian_profiles g, q, c where g.center_id=c.cid and g.deleted_at is null and lower(g.guardian_name) like q.pat limit 5)
    union all
    (select jsonb_build_object('kind','SNA 노드','id',e.id,'label',e.name,
      'sublabel',e.kind::text,'href','/sna')
    from sna_entities e, q, c where e.center_id=c.cid and e.deleted_at is null and lower(e.name) like q.pat limit 5)
    union all
    (select jsonb_build_object('kind','퀘스트','id',aq.id,'label',aq.title,
      'sublabel',aq.quest_type,'href','/quests')
    from analysis_quests aq, q, c where aq.center_id=c.cid and aq.deleted_at is null and lower(aq.title) like q.pat limit 5)
    union all
    (select jsonb_build_object('kind','기록','id',cn.id,'label',left(cn.content,40),
      'sublabel',cn.note_type::text,'href','/children/'||cn.child_id)
    from care_notes cn, q, c where cn.center_id=c.cid and cn.deleted_at is null and lower(cn.content) like q.pat limit 6)
  ) s;
$$;
revoke all on function public.global_search(text) from public, anon;
grant execute on function public.global_search(text) to authenticated;
