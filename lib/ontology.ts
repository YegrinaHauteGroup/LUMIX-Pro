// ============================================================
// LUMIX Pro — Ontology value types & controlled vocabularies
// Mirrors public.reference_categories (migration 020). Official
// standards: ISBT (ABO/Rh), WHO ICD-11, WHO IMCI, Codex/WHO allergens,
// WHO ICF-CY. Single frontend source of truth for coded health data.
// ============================================================

export interface RefItem { code: string; label: string; meta?: Record<string, unknown> }

// Blood type — ISBT ABO/Rh
export const BLOOD_TYPES: RefItem[] = [
  { code: 'O+', label: 'O Rh+' }, { code: 'O-', label: 'O Rh-' },
  { code: 'A+', label: 'A Rh+' }, { code: 'A-', label: 'A Rh-' },
  { code: 'B+', label: 'B Rh+' }, { code: 'B-', label: 'B Rh-' },
  { code: 'AB+', label: 'AB Rh+' }, { code: 'AB-', label: 'AB Rh-' },
]

// Disease classification — WHO ICD-11 chapters (pediatric-relevant subset)
export const ICD11_CATEGORIES: RefItem[] = [
  { code: 'INFECTIOUS', label: '감염성·기생충성 질환', meta: { chapter: '01', contagious: true } },
  { code: 'IMMUNE_ALLERGIC', label: '면역계 질환 (알레르기 포함)', meta: { chapter: '04' } },
  { code: 'ENDOCRINE_METABOLIC', label: '내분비·영양·대사 질환', meta: { chapter: '05' } },
  { code: 'MENTAL_NEURODEV', label: '정신·행동·신경발달 질환', meta: { chapter: '06' } },
  { code: 'NERVOUS', label: '신경계 질환', meta: { chapter: '08' } },
  { code: 'VISUAL', label: '시각계 질환', meta: { chapter: '09' } },
  { code: 'EAR', label: '귀·유돌 질환', meta: { chapter: '10' } },
  { code: 'RESPIRATORY', label: '호흡계 질환', meta: { chapter: '12', contagious: true } },
  { code: 'DIGESTIVE', label: '소화계 질환', meta: { chapter: '13' } },
  { code: 'SKIN', label: '피부 질환', meta: { chapter: '14' } },
  { code: 'MUSCULOSKELETAL', label: '근골격계·결합조직 질환', meta: { chapter: '15' } },
  { code: 'INJURY', label: '손상·중독·외인', meta: { chapter: '22' } },
]

// Symptom catalog — WHO IMCI aligned (contagious flag drives SNA contagion inference)
export const SYMPTOMS: RefItem[] = [
  { code: 'fever', label: '발열', meta: { contagious: true } },
  { code: 'cough', label: '기침', meta: { contagious: true } },
  { code: 'runny_nose', label: '콧물', meta: { contagious: true } },
  { code: 'sore_throat', label: '인후통', meta: { contagious: true } },
  { code: 'rash', label: '발진', meta: { contagious: true } },
  { code: 'vomiting', label: '구토', meta: { contagious: true } },
  { code: 'diarrhea', label: '설사', meta: { contagious: true } },
  { code: 'conjunctivitis', label: '결막염 (눈곱)', meta: { contagious: true } },
  { code: 'abdominal_pain', label: '복통', meta: { contagious: false } },
  { code: 'headache', label: '두통', meta: { contagious: false } },
  { code: 'ear_pain', label: '귀 통증', meta: { contagious: false } },
  { code: 'wheezing', label: '천명음 (쌕쌕거림)', meta: { contagious: false } },
  { code: 'fatigue', label: '피로·무기력', meta: { contagious: false } },
  { code: 'loss_appetite', label: '식욕 부진', meta: { contagious: false } },
]

// Allergen classes — Codex Alimentarius / WHO major allergens + environmental
export const ALLERGEN_CLASSES: RefItem[] = [
  { code: 'milk', label: '우유', meta: { group: 'food' } },
  { code: 'egg', label: '계란', meta: { group: 'food' } },
  { code: 'peanut', label: '땅콩', meta: { group: 'food' } },
  { code: 'tree_nut', label: '견과류', meta: { group: 'food' } },
  { code: 'soy', label: '대두', meta: { group: 'food' } },
  { code: 'wheat', label: '밀', meta: { group: 'food' } },
  { code: 'fish', label: '생선', meta: { group: 'food' } },
  { code: 'shellfish', label: '갑각류', meta: { group: 'food' } },
  { code: 'sesame', label: '참깨', meta: { group: 'food' } },
  { code: 'buckwheat', label: '메밀', meta: { group: 'food' } },
  { code: 'pollen', label: '꽃가루', meta: { group: 'environmental' } },
  { code: 'dust_mite', label: '집먼지진드기', meta: { group: 'environmental' } },
  { code: 'animal_dander', label: '동물 비듬·털', meta: { group: 'environmental' } },
  { code: 'medication', label: '약물', meta: { group: 'medication' } },
  { code: 'latex', label: '라텍스', meta: { group: 'contact' } },
]

// Developmental domains — WHO ICF-CY aligned
export const DEVELOPMENTAL_DOMAINS: RefItem[] = [
  { code: 'gross_motor', label: '대근육 운동' },
  { code: 'fine_motor', label: '소근육 운동' },
  { code: 'language', label: '언어·의사소통' },
  { code: 'cognitive', label: '인지' },
  { code: 'social_emotional', label: '사회성·정서' },
  { code: 'self_help', label: '자조·일상생활' },
]

export const HEALTH_EVENT_KINDS = [
  { code: 'symptom', label: '증상', domain: 'symptom', standard: 'WHO IMCI' },
  { code: 'diagnosis', label: '진단', domain: 'icd11_category', standard: 'WHO ICD-11' },
  { code: 'screening', label: '발달 선별', domain: 'developmental_domain', standard: 'WHO ICF-CY' },
  { code: 'incident', label: '안전 사고', domain: 'icd11_category', standard: 'WHO ICD-11' },
  { code: 'vaccination', label: '예방 접종', domain: 'icd11_category', standard: 'WHO' },
] as const

export const SEVERITY = [
  { code: 'mild', label: '경증' },
  { code: 'moderate', label: '중등도' },
  { code: 'severe', label: '중증' },
] as const

export const CATALOG_BY_DOMAIN: Record<string, RefItem[]> = {
  symptom: SYMPTOMS,
  icd11_category: ICD11_CATEGORIES,
  developmental_domain: DEVELOPMENTAL_DOMAINS,
  allergen_class: ALLERGEN_CLASSES,
  blood_type: BLOOD_TYPES,
}

export const labelOf = (domain: string, code: string) =>
  CATALOG_BY_DOMAIN[domain]?.find((x) => x.code === code)?.label ?? code

export const isContagious = (domain: string, code: string) =>
  Boolean((CATALOG_BY_DOMAIN[domain]?.find((x) => x.code === code)?.meta as { contagious?: boolean } | undefined)?.contagious)
