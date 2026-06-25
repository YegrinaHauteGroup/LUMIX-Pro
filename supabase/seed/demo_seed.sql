-- ============================================================
-- LUMIX Pro — demo seed (SNA test fixture)
-- ------------------------------------------------------------
-- Resets the demo center to a coherent 20-child dataset that
-- exercises the full multi-dimensional ontology:
--   children (active / isolated / sick / high-risk) · guardians ·
--   staff (teachers + director) · spaces · skills · food/allergens ·
--   achievement domains · ecosystem(VMS) · ~95 typed/labeled edges ·
--   health profiles · care notes (drive health flags) · meal logs ·
--   attendances · peer/staff/guardian assessments.
--
-- Re-runnable: it deletes the center's prior demo rows first.
-- After seeding, run the recompute engine to fill sna_metrics:
--   POST /functions/v1/recompute_sna_metrics {center_id, rebuild:false}
-- (or use the SNA board's "중심성 지표 재계산" button).
--
-- The :center is the demo center; change it for your own.
-- ============================================================
create temp table _ctx on commit drop as
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6'::uuid as center,
       '18048ff5-fe5e-4d9b-a32e-cb1c1ce0cdf2'::uuid as t_park,    -- 박민수 (app user, 햇님반)
       '39e1cee8-c935-4216-9ab8-56de09481095'::uuid as director, -- 김지영 (원장)
       gen_random_uuid() as sun, gen_random_uuid() as moon, gen_random_uuid() as t_lee;

delete from interactions               where center_id=(select center from _ctx);
delete from sna_metrics                where center_id=(select center from _ctx);
delete from peer_assessments           where center_id=(select center from _ctx);
delete from staff_child_assessments    where center_id=(select center from _ctx);
delete from guardian_child_assessments where center_id=(select center from _ctx);
delete from care_notes                 where center_id=(select center from _ctx);
delete from health_profiles            where center_id=(select center from _ctx);
delete from meal_logs                  where center_id=(select center from _ctx);
delete from attendances                where center_id=(select center from _ctx);
delete from child_guardians            where center_id=(select center from _ctx);
delete from sna_entities               where center_id=(select center from _ctx);
delete from activity_participations    where child_id in (select id from children where center_id=(select center from _ctx));
delete from children                   where center_id=(select center from _ctx);
delete from guardian_profiles          where center_id=(select center from _ctx);
delete from classes                    where center_id=(select center from _ctx);

update centers set address='서울특별시 강남구 테헤란로 152', latitude=37.4979, longitude=127.0276,
  region_code='11680', region_name='서울특별시 강남구'
where id=(select center from _ctx);

insert into staff_profiles(id,center_id,name,pin_hash,role)
select t_lee, center, '이수진','seed','teacher' from _ctx;

insert into classes(id,center_id,name,age_group,homeroom_staff_id,capacity)
select sun, center, '햇님반','5세', t_park, 12 from _ctx
union all select moon, center, '달님반','6세', t_lee, 12 from _ctx;

create temp table k(key text, name text, cls text, gender text, birth date) on commit drop;
insert into k values
 ('minsu','김민수','sun','male','2020-03-11'),('seoyeon','이서연','sun','female','2020-05-22'),
 ('doyun','박도윤','sun','male','2020-01-09'),('hajun','최하준','sun','male','2020-07-30'),
 ('jimin','정지민','sun','female','2020-02-18'),('yuna','강유나','sun','female','2020-09-02'),
 ('gunwoo','윤건우','sun','male','2020-04-14'),('jia','임지아','sun','female','2020-06-25'),
 ('siwoo','한시우','sun','male','2020-08-08'),('sua','오수아','sun','female','2020-11-19'),
 ('woojin','신우진','moon','male','2019-03-05'),('arin','서아린','moon','female','2019-05-16'),
 ('yunwoo','권윤우','moon','male','2019-01-28'),('seoa','황서아','moon','female','2019-07-07'),
 ('eunwoo','조은우','moon','male','2019-02-11'),('haeun','배하은','moon','female','2019-09-21'),
 ('jihun','남지훈','moon','male','2019-04-03'),('soyul','문소율','moon','female','2019-06-30'),
 ('sihyun','곽시현','moon','male','2019-08-15'),('dain','류다인','moon','female','2019-10-27');

create temp table kid(key text primary key, id uuid) on commit drop;
insert into kid select key, gen_random_uuid() from k;
insert into children(id,center_id,class_id,name,gender,birth_date,status,enrollment_type)
select kid.id, (select center from _ctx),
  case when k.cls='sun' then (select sun from _ctx) else (select moon from _ctx) end,
  k.name, k.gender, k.birth, 'active', 'general'
from k join kid using(key);

create temp table gid(key text primary key, id uuid, name text) on commit drop;
insert into gid select key, gen_random_uuid(), name||' 보호자' from k;
insert into guardian_profiles(id,center_id,guardian_name,guardian_phone)
select id, (select center from _ctx), name, '010-1000-'||lpad((row_number() over())::text,4,'0') from gid;
insert into child_guardians(center_id,child_id,guardian_id,relationship,is_primary)
select (select center from _ctx), kid.id, gid.id, '부모', true from kid join gid using(key);

create temp table ent(key text, kind node_kind, name text) on commit drop;
insert into ent values
 ('reading','space','독서 구역'),('nap','space','낮잠 구역'),('outdoor','space','야외 놀이터'),
 ('canteen','space','식당 구역'),('art','space','창작 영역'),
 ('origami','skill','종이접기'),('hangul','skill','한글 기초'),
 ('spinach','food','시금치'),('carrot','food','당근'),('peanut','food','땅콩'),
 ('math','achievement','수리 영역'),('lang','achievement','언어 영역'),('artdom','achievement','창의·예술 영역'),
 ('vms','ecosystem','VMS 공간지각 블록 콘텐츠');
create temp table entid(key text primary key, id uuid) on commit drop;
insert into entid select key, gen_random_uuid() from ent;
insert into sna_entities(id,center_id,kind,name)
select entid.id, (select center from _ctx), ent.kind, ent.name from ent join entid using(key);

create temp table node(key text primary key, kind node_kind, id uuid) on commit drop;
insert into node select 'c_'||key,'child',id from kid;
insert into node select 'g_'||key,'guardian',id from gid;
insert into node select key, kind, id from ent join entid using(key);
insert into node select 's_park','staff',t_park from _ctx;
insert into node select 's_lee','staff',t_lee from _ctx;
insert into node select 's_dir','staff',director from _ctx;

create temp table e(src text, tgt text, rel relation_type, w numeric, lbl text, dir boolean) on commit drop;
insert into e values
 ('c_minsu','c_seoyeon','play',3,'친밀',false),('c_minsu','c_gunwoo','play',4,'단짝',false),
 ('c_minsu','c_jia','play',1,'장난침',false),('c_minsu','c_hajun','conflict',2,'갈등(싸움)',false),
 ('c_seoyeon','c_yuna','play',2,'친밀',false),('c_seoyeon','c_hajun','help_seeking',2,'위로·양보',true),
 ('c_hajun','c_gunwoo','play',3,'친밀',false),('c_yuna','c_sua','play',3,'단짝',false),
 ('c_doyun','c_hajun','proximity',3,'밀접 접촉',false),('c_doyun','c_jia','proximity',2,'밀접 접촉',false),
 ('c_woojin','c_jihun','play',2,'친밀',false),('c_jia','c_woojin','play',2,'친밀',false),
 ('c_sua','c_arin','play',4,'단짝',false),('c_yunwoo','c_gunwoo','play',2,'친밀',false),
 ('c_seoa','c_jia','play',2,'친밀',false),('c_haeun','c_jihun','play',3,'단짝',false),
 ('c_soyul','c_sihyun','play',2,'친밀',false),('c_arin','c_haeun','proximity',2,'모방행동',false),
 ('c_yunwoo','c_woojin','conflict',2,'소유권 분쟁',false),('c_sua','c_seoa','conflict',2,'갈등(다툼)',false),
 ('c_dain','c_seoa','proximity',3,'밀접 접촉',false),('c_dain','c_soyul','proximity',2,'밀접 접촉',false),
 ('c_soyul','c_yuna','help_seeking',1,'도움요청',true),
 ('c_jimin','reading','proximity',3,'강한 선호',false),('c_siwoo','reading','proximity',2,'장소 선호',false),
 ('c_eunwoo','reading','proximity',3,'강한 선호',false),('c_doyun','nap','proximity',2,'장소 선호',false),
 ('c_hajun','nap','proximity',2,'장소 선호',false),('c_gunwoo','outdoor','proximity',3,'강한 선호',false),
 ('c_minsu','outdoor','proximity',3,'강한 선호',false),('c_dain','canteen','proximity',3,'강한 선호',false),
 ('c_seoa','canteen','proximity',2,'장소 선호',false),('c_haeun','art','proximity',3,'강한 선호',false),
 ('c_seoyeon','art','proximity',2,'장소 선호',false),('c_jia','art','proximity',2,'장소 선호',false),
 ('c_sua','nap','proximity',2,'장소 선호',false),('c_arin','reading','proximity',2,'장소 선호',false),
 ('c_jimin','outdoor','proximity',3,'강한 기피(소음)',false),('c_siwoo','canteen','proximity',3,'강한 기피(혼잡)',false),
 ('c_gunwoo','origami','help_seeking',3,'마스터함',false),('c_woojin','origami','help_seeking',2,'도움 필요',false),
 ('c_seoyeon','hangul','communication',3,'마스터함',false),('c_sihyun','hangul','help_seeking',2,'도움 필요',false),
 ('c_minsu','origami','help_seeking',3,'마스터함',false),('c_yuna','hangul','communication',3,'마스터함',false),
 ('c_eunwoo','origami','conflict',3,'심한 거부감',false),('c_jimin','origami','conflict',3,'심한 거부감',false),
 ('c_sua','spinach','conflict',3,'편식(거부)',false),('c_arin','spinach','play',3,'강한 선호',false),
 ('c_seoa','peanut','conflict',4,'알러지',false),('c_woojin','carrot','conflict',2,'편식(거부)',false),
 ('c_gunwoo','carrot','play',3,'강한 선호',false),('c_seoyeon','spinach','play',2,'선호',false),
 ('c_minsu','math','communication',2,'보충 요망',false),('c_seoyeon','math','communication',4,'상위 10%',false),
 ('c_hajun','math','communication',2,'기초 부족',false),('c_gunwoo','math','communication',3,'우수',false),
 ('c_jimin','lang','communication',4,'최우수',false),('c_seoyeon','lang','communication',3,'우수',false),
 ('c_haeun','lang','communication',2,'보충 요망',false),('c_jia','lang','communication',2,'어려워함',false),
 ('c_yunwoo','artdom','communication',4,'상위 5%',false),('c_minsu','artdom','communication',4,'탁월함(흥미)',false),
 ('c_woojin','artdom','communication',2,'참여도 저조',false),('c_eunwoo','artdom','communication',2,'심한 거부감',false),
 ('c_minsu','vms','play',2,'참여도 높음',false),('c_hajun','vms','play',2,'참여도 높음',false),
 ('c_gunwoo','vms','play',2,'참여도 높음',false),
 ('s_park','c_minsu','communication',2,'관찰 기록',false),('s_park','c_sua','caregiving',3,'강한 의존',false),
 ('s_park','c_doyun','caregiving',3,'건강·투약 관리',false),('s_lee','c_haeun','communication',2,'관찰 기록',false),
 ('s_lee','c_dain','caregiving',3,'특별 모니터링',false),('s_dir','s_park','communication',2,'업무 하중 확인',true),
 ('s_dir','s_lee','communication',2,'업무 하중 확인',true);

insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select (select center from _ctx), ns.kind, ns.id, nt.kind, nt.id, e.rel, e.w, e.dir, now(), 'seed', e.lbl
from e join node ns on ns.key=e.src join node nt on nt.key=e.tgt;

insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select (select center from _ctx), 'guardian', g.id, 'child', kid.id, 'caregiving', 1.5, false, now(), 'seed', '가족'
from kid join gid g using(key);

-- ---- supporting records ----------------------------------------------------
create temp table c on commit drop as
select id, name from children where center_id=(select center from _ctx) and deleted_at is null;
create temp table sctx on commit drop as
select (select center from _ctx) center,
  (select homeroom_staff_id from classes where name='햇님반' and center_id=(select center from _ctx)) park,
  (select homeroom_staff_id from classes where name='달님반' and center_id=(select center from _ctx)) lee;
create or replace function pg_temp.cid(p text) returns uuid language sql stable as $$ select id from c where name=p limit 1 $$;

insert into health_profiles(center_id, child_id, allergies, medications, conditions)
select (select center from sctx), pg_temp.cid(n), a, m, cond from (values
 ('황서아','땅콩, 견과류','에피펜 휴대','견과류 아나필락시스 위험'),
 ('박도윤','없음','해열제(필요시)','독감 확진 회복 중'),
 ('류다인','계란','없음','수족구 확진'),
 ('오수아','없음','없음','편식 경향(채소 거부)'),
 ('최하준','복숭아','없음','경미한 알레르기 비염')
) v(n,a,m,cond);

insert into care_notes(center_id, child_id, author_staff_id, noted_on, content, note_type)
select (select center from sctx), pg_temp.cid(n), st, current_date - d, content, t::note_type from (values
 ('박도윤', (select park from sctx), 2, '독감 확진 판정. 격리 및 보호자 귀가 조치 완료. 접촉 아동 모니터링 필요.', 'health'),
 ('류다인', (select lee from sctx), 1, '수족구 확진. 의사 소견서 제출, 등원 중지 안내.', 'health'),
 ('최하준', (select park from sctx), 1, '밀접 접촉 이력으로 고위험 관찰 대상. 체온 정기 측정 중.', 'health'),
 ('황서아', (select lee from sctx), 3, '간식 중 땅콩 미세 노출 주의. 알레르기 고위험, 식단 분리 철저.', 'health'),
 ('정지민', (select park from sctx), 4, '자유놀이 시간 또래와 어울리지 않고 독서 구역에서 혼자 활동. 관찰 지속 요망.', 'daily'),
 ('이서연', (select park from sctx), 2, '친구들 사이 다툼을 중재하는 모습. 한글 영역 우수.', 'learning'),
 ('오수아', (select park from sctx), 1, '점심 시간 시금치 거부. 절친 옆자리 배치로 식습관 유도 시도.', 'daily'),
 ('조은우', (select lee from sctx), 3, '종이접기 활동에 심한 거부감 표현. 대체 활동 제공 검토.', 'learning')
) v(n,st,d,content,t);

insert into meal_logs(center_id, child_id, logged_at, meal_type, intake, remarks, author_staff_id)
select (select center from sctx), pg_temp.cid(n), now() - (h||' hours')::interval, mt::meal_type, il::intake_level, r, (select park from sctx)
from (values
 ('오수아','lunch','refused','시금치 거부, 밥과 국만 섭취', 6),
 ('황서아','lunch','partial','땅콩 제외 특별식 제공', 6),
 ('김민수','lunch','all','전량 섭취', 6),
 ('서아린','lunch','all','시금치 잘 먹음', 6),
 ('류다인','snack','partial','계란 제외 간식', 2)
) v(n,mt,il,r,h);

insert into attendances(center_id, child_id, attendance_date, status, transport_method)
select (select center from sctx), c.id, d::date, 'present', 'walk'
from c, generate_series(current_date-9, current_date, interval '1 day') d;
update attendances set status='absent'
 where child_id=pg_temp.cid('한시우') and attendance_date in (current_date-1,current_date-3,current_date-6,current_date-8);
update attendances set status='absent'
 where child_id=pg_temp.cid('조은우') and attendance_date in (current_date-2,current_date-4,current_date-7);
update attendances set status='late'
 where child_id=pg_temp.cid('정지민') and attendance_date in (current_date-2,current_date-5);

insert into peer_assessments(center_id, from_child_id, to_child_id, dimension, score, assessed_on, assessed_by_staff_id)
select (select center from sctx), pg_temp.cid(f), pg_temp.cid(t), dim::score_dim, sc, current_date-3, (select park from sctx)
from (values
 ('김민수','이서연','social',90),('김민수','윤건우','social',95),('이서연','강유나','social',85),
 ('강유나','오수아','social',88),('최하준','윤건우','social',80),('배하은','남지훈','social',86),
 ('김민수','최하준','behavior',-70),('오수아','황서아','behavior',-60)
) v(f,t,dim,sc);

insert into staff_child_assessments(center_id, staff_id, child_id, dimension, score, assessed_on)
select (select center from sctx), st, pg_temp.cid(n), dim::score_dim, sc, current_date-2
from (values
 ((select park from sctx),'오수아','self_help',40),
 ((select park from sctx),'박도윤','health',30),
 ((select lee from sctx),'류다인','health',35),
 ((select park from sctx),'김민수','communication',90),
 ((select lee from sctx),'조은우','learning',35)
) v(st,n,dim,sc);

insert into guardian_child_assessments(center_id, guardian_name, child_id, dimension, score, assessed_on, guardian_profile_id)
select (select center from sctx), gp.guardian_name, pg_temp.cid(n), dim::score_dim, sc, current_date-1, gp.id
from (values ('김민수','communication',80),('황서아','self_help',75),('류다인','health',40)) v(n,dim,sc)
join guardian_profiles gp on gp.guardian_name = v.n||' 보호자' and gp.center_id=(select center from sctx);
