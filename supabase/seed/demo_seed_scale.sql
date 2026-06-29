-- ============================================================
-- LUMIX Pro — scale seed (200 children across 10 age-grouped classes)
-- ------------------------------------------------------------
-- Builds on top of demo_seed.sql (the 20-child hand-crafted SNA fixture).
-- Adds 8 age-grouped classes (만 0세 ~ 만 4세) and tops the center up to
-- exactly 200 active children, each with full detail:
--   children (body metrics, characteristics, dietary/developmental notes,
--   emergency contact, address) · guardians · 12-day attendance histories ·
--   health profiles · care notes · meal logs · within-class friendship/
--   conflict edges + class hubs · space/skill/achievement/allergy edges ·
--   peer + staff assessments.
--
-- Re-runnable: it first purges any prior run of these 8 classes and their
-- dependent rows, then regenerates. After seeding, recompute centrality:
--   POST /functions/v1/recompute_sna_metrics {center_id, rebuild:false}
--   (or the SNA board's "중심성 지표 재계산" button).
--
-- The center / teacher ids below match the demo center from demo_seed.sql.
-- ============================================================
do $$
declare
  v_center uuid := 'c1835e7e-815c-423c-b8f6-8b24cdc418e6';
  v_park uuid := '18048ff5-fe5e-4d9b-a32e-cb1c1ce0cdf2';  -- 박민수 (teacher)
  v_lee  uuid := '4245984e-9879-4073-90e0-7746675e78c1';  -- 이수진 (teacher)
  surnames text[] := array['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전','홍','고','문','손','배','백','허','유','남','심'];
  male_g text[]   := array['민준','서준','도윤','예준','시우','주원','하준','지호','준서','건우','현우','우진','선우','서진','연우','정우','승우','준우','지환','시윤','유준','지훈','이준','윤우','은우','시현','민재','현준','지원','태윤'];
  female_g text[] := array['서연','서윤','지우','서현','하은','하윤','민서','지유','윤서','채원','지민','수아','지아','다은','은서','예은','수빈','소율','예린','시아','유나','채은','지윤','윤아','은채','다인','예나','수현','시은','아린'];
  bloods text[]   := array['A','B','O','AB'];
  classnames text[] := array['새싹반','햇살반','별빛반','도토리반','초록반','노을반','파랑반','무지개반'];
  ages text[]       := array['만 0세','만 1세','만 1세','만 2세','만 2세','만 3세','만 3세','만 4세'];
  birthyears int[]  := array[2025,2024,2024,2023,2023,2022,2022,2021];
  classids uuid[] := '{}';
  v_need int; ci int; i int; age_y int;
  v_cls uuid; v_child uuid; v_guard uuid; v_gender text; v_name text; v_birth date; v_by int; v_staff uuid;
begin
  -- re-runnable purge of any prior run of these demo classes + dependents
  delete from interactions where center_id=v_center and (
      source_id in (select id from children where center_id=v_center and class_id in (select id from classes where center_id=v_center and name=any(classnames)))
   or target_id in (select id from children where center_id=v_center and class_id in (select id from classes where center_id=v_center and name=any(classnames))));
  delete from peer_assessments where center_id=v_center and (from_child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames))) or to_child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames))));
  delete from staff_child_assessments where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from care_notes where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from health_profiles where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from meal_logs where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from attendances where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from child_guardians where center_id=v_center and child_id in (select id from children where class_id in (select id from classes where center_id=v_center and name=any(classnames)));
  delete from children where center_id=v_center and class_id in (select id from classes where center_id=v_center and name=any(classnames));
  delete from classes where center_id=v_center and name=any(classnames);

  -- 8 new age-grouped classes (alternating homeroom teacher)
  for ci in 1..array_length(classnames,1) loop
    v_cls := gen_random_uuid();
    insert into classes(id,center_id,name,age_group,homeroom_staff_id,capacity,description)
      values (v_cls, v_center, classnames[ci], ages[ci], case when ci%2=0 then v_lee else v_park end, 25, ages[ci]||' 보육반 · 정원 25명');
    classids := classids || v_cls;
  end loop;

  -- top up to exactly 200 active children, round-robin across the new classes
  v_need := 200 - (select count(*) from children where center_id=v_center and deleted_at is null);
  if v_need < 0 then v_need := 0; end if;

  for i in 1..v_need loop
    ci := 1 + ((i-1) % array_length(classnames,1));
    v_cls := classids[ci]; v_by := birthyears[ci]; age_y := 2026 - v_by;
    v_staff := case when ci%2=0 then v_lee else v_park end;
    v_gender := case when i % 2 = 0 then 'female' else 'male' end;
    v_name := surnames[1+((i*7) % array_length(surnames,1))] ||
              case when v_gender='male' then male_g[1+((i*13)%array_length(male_g,1))] else female_g[1+((i*13)%array_length(female_g,1))] end;
    v_birth := make_date(v_by, 1+((i*5)%12), 1+((i*11)%27));
    v_child := gen_random_uuid();
    insert into children(id,center_id,class_id,name,gender,birth_date,status,enrollment_type,
        blood_type,height_cm,weight_kg,learning_level,characteristics,dietary_notes,developmental_notes,
        emergency_contact_name,emergency_contact_phone,address,nationality,native_language,primary_teacher_id)
      values (v_child,v_center,v_cls,v_name,v_gender,v_birth,'active',
        (case when i%9=0 then 'beneficiary' else 'general' end)::enrollment_type,
        bloods[1+(i%4)], round((60 + age_y*11 + (i%7))::numeric,1), round((7 + age_y*2.2 + (i%4)*0.4)::numeric,1),
        (array['표준','기본','심화'])[1+(i%3)],
        (array['활발하고 사교적','차분하고 집중력 높음','호기심 많고 활동적','수줍음 많고 관찰형','리더십 있고 주도적','감수성 풍부하고 표현력 좋음'])[1+(i%6)],
        (array['특이 식이 없음','채소 선호','유제품 선호','단 음식 선호 주의','골고루 잘 먹음'])[1+(i%5)],
        (array['연령 기준 발달 양호','언어 발달 우수','대근육 발달 활발','소근육 정밀성 발달 중','정서·사회성 발달 양호'])[1+(i%5)],
        v_name||' 보호자', '010-'||lpad((1000+i)::text,4,'0')||'-'||lpad(((i*37)%10000)::text,4,'0'),
        '서울특별시 강남구 테헤란로 '||(100+i)||'길 '||(1+(i%40)), '대한민국', '한국어', v_staff);

    v_guard := gen_random_uuid();
    insert into guardian_profiles(id,center_id,guardian_name,guardian_phone)
      values (v_guard,v_center, v_name||' 보호자 #'||i, '010-'||lpad((2000+i)::text,4,'0')||'-'||lpad(((i*53)%10000)::text,4,'0'));
    insert into child_guardians(center_id,child_id,guardian_id,relationship,is_primary,is_emergency_contact)
      values (v_center,v_child,v_guard,'부모',true,true);
    insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
      values (v_center,'guardian',v_guard,'child',v_child,'caregiving',1.5,false,now(),'seed','가족');

    insert into attendances(center_id,child_id,attendance_date,status,transport_method)
      select v_center, v_child, dd::date,
        (case when (extract(dow from dd)::int + i) % 13 = 0 then 'absent'
              when (extract(dow from dd)::int + i) % 11 = 0 then 'late'
              when (extract(dow from dd)::int + i) % 17 = 0 then 'early_leave'
              else 'present' end)::attendance_status,
        (case when i%3=0 then 'vehicle' else 'walk' end)::transport_method
      from generate_series(current_date-11, current_date, interval '1 day') dd;

    if i % 5 = 0 then
      insert into health_profiles(center_id,child_id,allergies,medications,conditions,blood_type)
        values (v_center,v_child,
          (array['땅콩, 견과류','계란','우유','복숭아','없음'])[1+(i%5)],
          (array['에피펜 휴대','없음','없음','해열제(필요시)','없음'])[1+(i%5)],
          (array['견과류 알레르기 주의','아토피 피부염 관리','경미한 천식','알레르기성 비염','특이사항 없음'])[1+(i%5)],
          bloods[1+(i%4)]);
    end if;

    if i % 4 = 0 then
      insert into care_notes(center_id,child_id,author_staff_id,noted_on,content,note_type)
        values (v_center,v_child,v_staff, current_date-(i%7),
          (array['자유놀이 시간 또래와 활발히 상호작용. 사회성 발달 양호.','낮잠 적응 완료, 정서적으로 안정됨.','한글·수리 활동에 높은 흥미. 집중력 우수.','등원 초기 분리불안 관찰. 정서 지원 지속.','식사 시 편식 경향. 채소 섭취 유도 중.','대근육 활동 적극 참여. 신체 발달 활발.','또래 갈등 시 자기표현 미흡. 의사소통 지도 요망.'])[1+(i%7)],
          (array['daily','daily','learning','daily','daily','daily','learning'])[1+(i%7)]::note_type);
    end if;

    if i % 4 = 1 then
      insert into meal_logs(center_id,child_id,logged_at,meal_type,intake,remarks,author_staff_id)
        values (v_center,v_child, now()-((i%8)||' hours')::interval, 'lunch',
          (array['all','partial','refused'])[1+(i%3)]::intake_level,
          (array['전량 섭취','절반 섭취','거부, 대체식 제공'])[1+(i%3)], v_staff);
    end if;
  end loop;
end $$;

-- ---- within-class SNA structure + assessments ------------------------------
create temp table rr on commit drop as
select c.id, c.class_id,
  row_number() over (partition by c.class_id order by c.created_at, c.id)::int rn,
  count(*) over (partition by c.class_id)::int n
from children c join classes cl on cl.id=c.class_id
where c.center_id='c1835e7e-815c-423c-b8f6-8b24cdc418e6'
  and cl.name in ('새싹반','햇살반','별빛반','도토리반','초록반','노을반','파랑반','무지개반')
  and c.deleted_at is null;

-- friendship chain (keeps each class connected)
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'child',b.id,'play',2+(a.rn%3),false,now(),'seed',
  (array['친밀','단짝','자주 어울림','같이 놀이'])[1+(a.rn%4)]
from rr a join rr b on b.class_id=a.class_id and b.rn=a.rn+1;

-- friendship chords (density)
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'child',b.id,'play',1+(a.rn%2),false,now(),'seed','가끔 어울림'
from rr a join rr b on b.class_id=a.class_id and b.rn=a.rn+2 and a.rn%2=0;

-- class hub (a high-degree broker per class → meaningful betweenness)
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'child',b.id,'play',3,false,now(),'seed','단짝'
from rr a join rr b on b.class_id=a.class_id and a.rn=1 and b.rn=any(array[4,7,10,13,16]);

-- conflict pairs
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'child',b.id,'conflict',2,false,now(),'seed','갈등(다툼)'
from rr a join rr b on b.class_id=a.class_id and b.rn=a.rn+5 and a.rn%10=3;

-- each child → a preferred space
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'space',
  (array['66ae8476-0fd1-467b-bd70-1ace1acf37e9','3cdcf15b-3719-46c9-a0b8-13459e01988f','8734e2d9-f615-48ee-b6df-37d164853949','f0034f42-e83f-4e7c-b6fe-8c36fda7fc85','4457cbe6-5550-468d-ba56-ff53f3c26bc0']::uuid[])[1+(a.rn%5)],
  'proximity',2+(a.rn%2),false,now(),'seed',(array['장소 선호','강한 선호','자주 이용'])[1+(a.rn%3)]
from rr a;

-- achievement-domain signals (mixed: strong vs needs-support → feeds achievement_gap)
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'achievement',
  (array['d4438a0d-22e5-4a40-89bf-b41621427112','f56356ed-402a-49e9-a721-d3c0dd85c6c2','a42357c1-e639-4f68-bb77-3f8da35dc6db']::uuid[])[1+(a.rn%3)],
  'communication',2+(a.rn%3),false,now(),'seed',(array['상위 10%','우수','보충 요망','기초 부족','최우수'])[1+(a.rn%5)]
from rr a where a.rn%2=0;

-- skill mastery / help-seeking
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'skill',
  (array['91294ada-3f64-4e68-a01b-3ef4abbb2361','d552eb1c-45ac-4b32-b22a-2286ddb40be1']::uuid[])[1+(a.rn%2)],
  'help_seeking',2,false,now(),'seed',(case when a.rn%2=0 then '마스터함' else '도움 필요' end)
from rr a where a.rn%3=0;

-- allergy / picky-eating food edges
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'food','4af99c87-34c1-47c0-a7c0-d5e154473ac0','conflict',4,false,now(),'seed','알러지'
from rr a where a.rn%5=0;
insert into interactions(center_id,source_kind,source_id,target_kind,target_id,relation_type,weight,is_directed,occurred_at,note,label)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','child',a.id,'food','418666ba-6de6-48bc-9c88-98ddf951e169','conflict',3,false,now(),'seed','편식(거부)'
from rr a where a.rn%7=0;

-- peer social assessments along friendship chain
insert into peer_assessments(center_id,from_child_id,to_child_id,dimension,score,assessed_on,assessed_by_staff_id)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6',a.id,b.id,'social',75+(a.rn%5)*4,current_date-3,'18048ff5-fe5e-4d9b-a32e-cb1c1ce0cdf2'
from rr a join rr b on b.class_id=a.class_id and b.rn=a.rn+1;

-- staff developmental assessments (subset)
insert into staff_child_assessments(center_id,staff_id,child_id,dimension,score,assessed_on)
select 'c1835e7e-815c-423c-b8f6-8b24cdc418e6','18048ff5-fe5e-4d9b-a32e-cb1c1ce0cdf2',a.id,
  (array['social','communication','learning','self_help','behavior','health'])[1+(a.rn%6)]::score_dim,
  40+(a.rn%6)*9, current_date-2
from rr a where a.rn%4=0;
