-- ============================================================
-- Migration 020: Foundry-style Ontology + WHO/standard reference layer
-- ------------------------------------------------------------
-- Concretizes the data model with semantic concepts modelled on the
-- Palantir Foundry Ontology (Object Types, Link Types, Value Types) and
-- attaches official controlled vocabularies (WHO ICD-11, ISBT ABO/Rh,
-- Codex/WHO major allergens, WHO ICF-CY developmental domains, common
-- pediatric symptom catalog). Adds a dated, coded health_events stream
-- so SNA + the analysis pipeline can perform epidemiological inference.
-- ============================================================

-- 1) Controlled vocabulary (global, read-only reference data) -----------
create table if not exists public.reference_categories (
  domain text not null,
  code   text not null,
  label  text not null,
  parent_code text,
  sort int not null default 0,
  standard text,
  meta jsonb not null default '{}'::jsonb,
  primary key (domain, code)
);
alter table public.reference_categories enable row level security;
drop policy if exists ref_cat_sel on public.reference_categories;
create policy ref_cat_sel on public.reference_categories for select to authenticated using (true);

-- 2) Ontology metadata registries (Foundry-style) ----------------------
create table if not exists public.ontology_object_types (
  api_name text primary key,
  display_name text not null,
  description text,
  node_kind text,
  base_table text,
  title_property text,
  icon text, color text, group_label text,
  sort int not null default 0
);
create table if not exists public.ontology_value_types (
  api_name text primary key,
  display_name text not null,
  base_type text not null,
  domain text,
  standard text,
  description text,
  sort int not null default 0
);
create table if not exists public.ontology_link_types (
  api_name text primary key,
  display_name text not null,
  source_type text not null,
  target_type text not null,
  cardinality text not null default 'MANY_TO_MANY',
  directed boolean not null default false,
  relation_type text,
  semantic text,
  description text,
  sort int not null default 0
);
alter table public.ontology_object_types enable row level security;
alter table public.ontology_value_types  enable row level security;
alter table public.ontology_link_types   enable row level security;
drop policy if exists oot_sel on public.ontology_object_types;
drop policy if exists ovt_sel on public.ontology_value_types;
drop policy if exists olt_sel on public.ontology_link_types;
create policy oot_sel on public.ontology_object_types for select to authenticated using (true);
create policy ovt_sel on public.ontology_value_types  for select to authenticated using (true);
create policy olt_sel on public.ontology_link_types   for select to authenticated using (true);

-- 3) Dated, coded health events (epidemiological dataset) ---------------
create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  event_date date not null default current_date,
  kind text not null default 'symptom',
  domain text,
  code text,
  label text,
  severity text not null default 'mild',
  status text not null default 'active',
  onset_on date,
  resolved_on date,
  contagious boolean not null default false,
  recorded_by_staff_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint health_events_kind_chk   check (kind in ('symptom','diagnosis','screening','incident','vaccination')),
  constraint health_events_sev_chk    check (severity in ('mild','moderate','severe')),
  constraint health_events_status_chk check (status in ('active','resolved'))
);
create index if not exists idx_health_events_center on public.health_events(center_id, event_date desc) where deleted_at is null;
create index if not exists idx_health_events_child  on public.health_events(child_id, event_date desc) where deleted_at is null;
create index if not exists idx_health_events_code   on public.health_events(center_id, domain, code) where deleted_at is null;

alter table public.health_events enable row level security;
drop policy if exists health_events_sel on public.health_events;
drop policy if exists health_events_ins on public.health_events;
drop policy if exists health_events_upd on public.health_events;
drop policy if exists health_events_del on public.health_events;
create policy health_events_sel on public.health_events for select to authenticated
  using (center_id = public.current_user_center_id() and deleted_at is null);
create policy health_events_ins on public.health_events for insert to authenticated
  with check (center_id = public.current_user_center_id());
create policy health_events_upd on public.health_events for update to authenticated
  using (center_id = public.current_user_center_id()) with check (center_id = public.current_user_center_id());
create policy health_events_del on public.health_events for delete to authenticated
  using (center_id = public.current_user_center_id());

drop trigger if exists set_health_events_updated_at on public.health_events;
create trigger set_health_events_updated_at before update on public.health_events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit_health_events on public.health_events;
create trigger trg_audit_health_events after insert or update or delete on public.health_events
  for each row execute function public.log_audit();

-- 4) Structured health_profiles columns (coded, standards-based) --------
alter table public.health_profiles
  add column if not exists blood_type text,
  add column if not exists allergen_codes text[] not null default '{}',
  add column if not exists chronic_condition_codes text[] not null default '{}',
  add column if not exists last_screened_on date;

-- ============================================================
-- 5) SEED — official controlled vocabularies
-- ============================================================

-- Blood type (ISBT / ABO-Rh)
insert into public.reference_categories (domain, code, label, sort, standard) values
  ('blood_type','O+','O Rh+',1,'ISBT ABO/Rh'),('blood_type','O-','O Rh-',2,'ISBT ABO/Rh'),
  ('blood_type','A+','A Rh+',3,'ISBT ABO/Rh'),('blood_type','A-','A Rh-',4,'ISBT ABO/Rh'),
  ('blood_type','B+','B Rh+',5,'ISBT ABO/Rh'),('blood_type','B-','B Rh-',6,'ISBT ABO/Rh'),
  ('blood_type','AB+','AB Rh+',7,'ISBT ABO/Rh'),('blood_type','AB-','AB Rh-',8,'ISBT ABO/Rh')
on conflict (domain, code) do update set label=excluded.label, sort=excluded.sort, standard=excluded.standard;

-- ICD-11 chapter categories (WHO, pediatric-relevant subset)
insert into public.reference_categories (domain, code, label, sort, standard, meta) values
  ('icd11_category','INFECTIOUS','감염성·기생충성 질환',1,'WHO ICD-11','{"chapter":"01","contagious":true}'),
  ('icd11_category','IMMUNE_ALLERGIC','면역계 질환 (알레르기 포함)',2,'WHO ICD-11','{"chapter":"04"}'),
  ('icd11_category','ENDOCRINE_METABOLIC','내분비·영양·대사 질환',3,'WHO ICD-11','{"chapter":"05"}'),
  ('icd11_category','MENTAL_NEURODEV','정신·행동·신경발달 질환',4,'WHO ICD-11','{"chapter":"06"}'),
  ('icd11_category','NERVOUS','신경계 질환',5,'WHO ICD-11','{"chapter":"08"}'),
  ('icd11_category','VISUAL','시각계 질환',6,'WHO ICD-11','{"chapter":"09"}'),
  ('icd11_category','EAR','귀·유돌 질환',7,'WHO ICD-11','{"chapter":"10"}'),
  ('icd11_category','RESPIRATORY','호흡계 질환',8,'WHO ICD-11','{"chapter":"12","contagious":true}'),
  ('icd11_category','DIGESTIVE','소화계 질환',9,'WHO ICD-11','{"chapter":"13"}'),
  ('icd11_category','SKIN','피부 질환',10,'WHO ICD-11','{"chapter":"14"}'),
  ('icd11_category','MUSCULOSKELETAL','근골격계·결합조직 질환',11,'WHO ICD-11','{"chapter":"15"}'),
  ('icd11_category','INJURY','손상·중독·외인',12,'WHO ICD-11','{"chapter":"22"}')
on conflict (domain, code) do update set label=excluded.label, sort=excluded.sort, standard=excluded.standard, meta=excluded.meta;

-- Common pediatric symptom catalog (WHO IMCI-aligned)
insert into public.reference_categories (domain, code, label, sort, standard, meta) values
  ('symptom','fever','발열',1,'WHO IMCI','{"contagious":true}'),
  ('symptom','cough','기침',2,'WHO IMCI','{"contagious":true}'),
  ('symptom','runny_nose','콧물',3,'WHO IMCI','{"contagious":true}'),
  ('symptom','sore_throat','인후통',4,'WHO IMCI','{"contagious":true}'),
  ('symptom','rash','발진',5,'WHO IMCI','{"contagious":true}'),
  ('symptom','vomiting','구토',6,'WHO IMCI','{"contagious":true}'),
  ('symptom','diarrhea','설사',7,'WHO IMCI','{"contagious":true}'),
  ('symptom','conjunctivitis','결막염 (눈곱)',8,'WHO IMCI','{"contagious":true}'),
  ('symptom','abdominal_pain','복통',9,'WHO IMCI','{"contagious":false}'),
  ('symptom','headache','두통',10,'WHO IMCI','{"contagious":false}'),
  ('symptom','ear_pain','귀 통증',11,'WHO IMCI','{"contagious":false}'),
  ('symptom','wheezing','천명음 (쌕쌕거림)',12,'WHO IMCI','{"contagious":false}'),
  ('symptom','fatigue','피로·무기력',13,'WHO IMCI','{"contagious":false}'),
  ('symptom','loss_appetite','식욕 부진',14,'WHO IMCI','{"contagious":false}')
on conflict (domain, code) do update set label=excluded.label, sort=excluded.sort, standard=excluded.standard, meta=excluded.meta;

-- Major allergen classes (Codex Alimentarius / WHO) + environmental
insert into public.reference_categories (domain, code, label, sort, standard, meta) values
  ('allergen_class','milk','우유',1,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','egg','계란',2,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','peanut','땅콩',3,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','tree_nut','견과류',4,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','soy','대두',5,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','wheat','밀',6,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','fish','생선',7,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','shellfish','갑각류',8,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','sesame','참깨',9,'Codex/WHO','{"group":"food"}'),
  ('allergen_class','buckwheat','메밀',10,'KFDA/Codex','{"group":"food"}'),
  ('allergen_class','pollen','꽃가루',11,'WHO','{"group":"environmental"}'),
  ('allergen_class','dust_mite','집먼지진드기',12,'WHO','{"group":"environmental"}'),
  ('allergen_class','animal_dander','동물 비듬·털',13,'WHO','{"group":"environmental"}'),
  ('allergen_class','medication','약물',14,'WHO','{"group":"medication"}'),
  ('allergen_class','latex','라텍스',15,'WHO','{"group":"contact"}')
on conflict (domain, code) do update set label=excluded.label, sort=excluded.sort, standard=excluded.standard, meta=excluded.meta;

-- Developmental domains (WHO ICF-CY aligned)
insert into public.reference_categories (domain, code, label, sort, standard) values
  ('developmental_domain','gross_motor','대근육 운동',1,'WHO ICF-CY'),
  ('developmental_domain','fine_motor','소근육 운동',2,'WHO ICF-CY'),
  ('developmental_domain','language','언어·의사소통',3,'WHO ICF-CY'),
  ('developmental_domain','cognitive','인지',4,'WHO ICF-CY'),
  ('developmental_domain','social_emotional','사회성·정서',5,'WHO ICF-CY'),
  ('developmental_domain','self_help','자조·일상생활',6,'WHO ICF-CY')
on conflict (domain, code) do update set label=excluded.label, sort=excluded.sort, standard=excluded.standard;

-- ============================================================
-- 6) SEED — ontology metadata (object / value / link types)
-- ============================================================
insert into public.ontology_object_types (api_name, display_name, description, node_kind, base_table, title_property, icon, color, group_label, sort) values
  ('Child','아동','보육 대상 아동 — 온톨로지의 핵심 객체','child','children','name','user','#137cbd','핵심',1),
  ('Class','반','아동이 소속된 학급 그룹',null,'classes','name','book','#0f9960','핵심',2),
  ('Activity','활동','교육·치료·상담 등 프로그램 활동',null,'activities','title','calendar','#d9822b','핵심',3),
  ('Staff','교직원','담임·치료사 등 인적 자원','staff','staff_profiles','name','user-cog','#8b5cf6','인적',4),
  ('Guardian','보호자','아동의 법적 보호자','guardian','guardian_profiles','guardian_name','users','#fb7185','인적',5),
  ('HealthEvent','건강 이벤트','WHO 코드 기반 증상·진단 기록','child','health_events','label','activity','#e5484d','보건',6),
  ('Space','공간','물리적 활동 공간','space','sna_entities','name','map-pin','#0f172a','환경',7),
  ('Skill','발달 스킬','발달 영역/스킬 노드','skill','sna_entities','name','sparkles','#f59e0b','발달',8),
  ('Achievement','성취','학습 성취 영역','achievement','sna_entities','name','award','#eab308','발달',9),
  ('Food','식재료','급식·간식 식재료 (알레르겐 연결)','food','sna_entities','name','utensils','#10b981','보건',10),
  ('Ecosystem','생태계','지역·환경 생태 노드','ecosystem','sna_entities','name','globe','#06b6d4','환경',11)
on conflict (api_name) do update set display_name=excluded.display_name, description=excluded.description,
  node_kind=excluded.node_kind, base_table=excluded.base_table, title_property=excluded.title_property,
  icon=excluded.icon, color=excluded.color, group_label=excluded.group_label, sort=excluded.sort;

insert into public.ontology_value_types (api_name, display_name, base_type, domain, standard, description, sort) values
  ('BloodType','혈액형','code','blood_type','ISBT ABO/Rh','ABO식 + Rh식 혈액형',1),
  ('ICD11Category','질병 분류','code','icd11_category','WHO ICD-11','WHO 국제질병분류 11판 챕터',2),
  ('Symptom','증상','code','symptom','WHO IMCI','소아 통합관리(IMCI) 증상 카탈로그',3),
  ('AllergenClass','알레르겐','code','allergen_class','Codex/WHO','Codex 주요 알레르겐 + 환경 알레르겐',4),
  ('DevelopmentalDomain','발달 영역','code','developmental_domain','WHO ICF-CY','국제 기능·장애·건강 분류(아동·청소년)',5),
  ('Severity','중증도','enum',null,'내부','mild·moderate·severe',6)
on conflict (api_name) do update set display_name=excluded.display_name, base_type=excluded.base_type,
  domain=excluded.domain, standard=excluded.standard, description=excluded.description, sort=excluded.sort;

insert into public.ontology_link_types (api_name, display_name, source_type, target_type, cardinality, directed, relation_type, semantic, description, sort) values
  ('enrolledIn','소속','Child','Class','MANY_TO_ONE',true,null,'enrollment','아동이 반에 소속',1),
  ('peerPlay','또래 놀이','Child','Child','MANY_TO_MANY',false,'play','social','함께 노는 또래 관계',2),
  ('peerConflict','또래 갈등','Child','Child','MANY_TO_MANY',false,'conflict','social','갈등·분쟁 관계',3),
  ('helpSeeking','도움 요청','Child','Child','MANY_TO_MANY',true,'help_seeking','social','도움을 요청하는 방향성 관계',4),
  ('caredBy','돌봄','Staff','Child','ONE_TO_MANY',true,'caregiving','care','교사의 아동 돌봄·관찰',5),
  ('proximity','근접','Child','Space','MANY_TO_MANY',false,'proximity','spatial','공간 선호/근접',6),
  ('exposedTo','노출','Child','HealthEvent','MANY_TO_MANY',true,null,'epidemiological','전염성 증상 노출 경로(추론)',7),
  ('allergicTo','알레르기','Child','Food','MANY_TO_MANY',true,'conflict','health','아동-식재료 알레르기 충돌',8),
  ('achievedIn','성취','Child','Achievement','MANY_TO_MANY',true,null,'learning','학습 성취 연결',9)
on conflict (api_name) do update set display_name=excluded.display_name, source_type=excluded.source_type,
  target_type=excluded.target_type, cardinality=excluded.cardinality, directed=excluded.directed,
  relation_type=excluded.relation_type, semantic=excluded.semantic, description=excluded.description, sort=excluded.sort;

-- ============================================================
-- 7) get_ontology() — Foundry-style schema + vocabulary for the UI
-- ============================================================
create or replace function public.get_ontology()
returns jsonb language sql stable security invoker
set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'object_types', coalesce((select jsonb_agg(to_jsonb(o) order by o.sort) from ontology_object_types o),'[]'::jsonb),
    'link_types',   coalesce((select jsonb_agg(to_jsonb(l) order by l.sort) from ontology_link_types l),'[]'::jsonb),
    'value_types',  coalesce((select jsonb_agg(to_jsonb(v) order by v.sort) from ontology_value_types v),'[]'::jsonb),
    'categories',   coalesce((select jsonb_object_agg(domain, items) from (
                       select domain, jsonb_agg(jsonb_build_object('code',code,'label',label,'standard',standard,'meta',meta) order by sort) items
                       from reference_categories group by domain) z),'{}'::jsonb)
  );
$$;
revoke all on function public.get_ontology() from public, anon;
grant execute on function public.get_ontology() to authenticated, service_role;
