// ============================================================
// LUMIX Pro - run_quest
// ------------------------------------------------------------
// Executes a user-defined analysis "quest" over the center's
// ontology data and writes a structured result back to
// public.analysis_quests.
//
// Body: { center_id: string, quest_id: string }
// Result shape: { headline, stats:[{label,value}], rows:[{primary,secondary,tag}] }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.47.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } })

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) { const raw = Deno.env.get('SUPABASE_SECRET_KEYS'); if (raw) { try { key = JSON.parse(raw)['sb_secret_5x67m'] } catch { /* ignore */ } } }
  if (!url || !key) throw new Error('SUPABASE_URL / service role key required')
  return createClient(url, key, { auth: { persistSession: false } })
}

type Row = { primary: string; secondary?: string; tag?: string }
type Result = { headline: string; stats: { label: string; value: string | number }[]; rows: Row[] }

// deno-lint-ignore no-explicit-any
type SB = any

// Optional quest scope (set per-request from analysis_quests.params).
let CURRENT_CLASS: string | null = null

async function activeChildren(sb: SB, center: string) {
  let qb = sb.from('children').select('id, name, class_id')
    .eq('center_id', center).eq('status', 'active').is('deleted_at', null)
  if (CURRENT_CLASS) qb = qb.eq('class_id', CURRENT_CLASS)
  const { data } = await qb
  return (data ?? []) as { id: string; name: string; class_id: string | null }[]
}
async function latestMetrics(sb: SB, center: string) {
  const { data } = await sb.from('sna_metrics')
    .select('child_id, degree, betweenness, eigenvector, is_isolated, community_id, computed_at')
    .eq('center_id', center).order('computed_at', { ascending: false })
  const m = new Map<string, any>()
  for (const r of data ?? []) if (!m.has(r.child_id)) m.set(r.child_id, r)
  return m
}
// id -> name for every node kind (children, staff, guardians, sna_entities)
async function nodeNames(sb: SB, center: string) {
  const names = new Map<string, { name: string; kind: string }>()
  const [ch, st, gu, en] = await Promise.all([
    sb.from('children').select('id, name').eq('center_id', center).is('deleted_at', null),
    sb.from('staff_profiles').select('id, name').eq('center_id', center).is('deleted_at', null),
    sb.from('guardian_profiles').select('id, guardian_name').eq('center_id', center).is('deleted_at', null),
    sb.from('sna_entities').select('id, name, kind').eq('center_id', center).is('deleted_at', null),
  ])
  for (const r of ch.data ?? []) names.set(r.id, { name: r.name, kind: 'child' })
  for (const r of st.data ?? []) names.set(r.id, { name: r.name, kind: 'staff' })
  for (const r of gu.data ?? []) names.set(r.id, { name: r.guardian_name, kind: 'guardian' })
  for (const r of en.data ?? []) names.set(r.id, { name: r.name, kind: r.kind })
  return names
}
async function interactions(sb: SB, center: string) {
  const { data } = await sb.from('interactions')
    .select('source_kind, source_id, target_kind, target_id, relation_type, weight, label')
    .eq('center_id', center).is('deleted_at', null).gt('weight', 0)
  return (data ?? []) as any[]
}
// WHO / standard controlled-vocabulary lookup (code -> { label, meta })
async function refLabels(sb: SB, domain: string) {
  const { data } = await sb.from('reference_categories').select('code, label, meta').eq('domain', domain)
  const m = new Map<string, { label: string; meta: any }>()
  for (const r of data ?? []) m.set(r.code, { label: r.label, meta: r.meta ?? {} })
  return m
}

async function questIsolation(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const metrics = await latestMetrics(sb, center)
  const ids = children.map((c) => c.id)
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const { data: att } = ids.length
    ? await sb.from('attendances').select('child_id, status').in('child_id', ids).gte('attendance_date', since)
    : { data: [] }
  const absences = new Map<string, number>()
  for (const a of att ?? []) if (a.status === 'absent') absences.set(a.child_id, (absences.get(a.child_id) ?? 0) + 1)

  const rows: Row[] = []
  for (const c of children) {
    const m = metrics.get(c.id)
    const reasons: string[] = []
    if (!m || m.is_isolated || (m.degree ?? 0) === 0) reasons.push('관계망 고립')
    else if ((m.degree ?? 0) <= 1) reasons.push('연결 1개 이하')
    const ab = absences.get(c.id) ?? 0
    if (ab >= 3) reasons.push(`최근 30일 결석 ${ab}회`)
    if (reasons.length) rows.push({ primary: c.name, secondary: reasons.join(' · '), tag: reasons.length >= 2 ? '높음' : '주의' })
  }
  rows.sort((a, b) => (a.tag === '높음' ? -1 : 1) - (b.tag === '높음' ? -1 : 1))
  return {
    headline: rows.length ? `${rows.length}명의 아동이 사회적 고립 위험 신호를 보입니다.` : '고립 위험 아동이 없습니다.',
    stats: [{ label: '대상 아동', value: children.length }, { label: '위험 신호', value: rows.length }],
    rows,
  }
}

async function questTutor(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const metrics = await latestMetrics(sb, center)
  const enriched = children.map((c) => ({ ...c, eig: metrics.get(c.id)?.eigenvector ?? 0, deg: metrics.get(c.id)?.degree ?? 0 }))
  const mentors = [...enriched].filter((c) => c.eig > 0).sort((a, b) => b.eig - a.eig)
  const learners = [...enriched].sort((a, b) => a.eig - b.eig).filter((c) => c.deg <= 1 || c.eig === 0)
  const rows: Row[] = []
  const used = new Set<string>()
  for (const l of learners) {
    const mentor = mentors.find((m) => m.id !== l.id && !used.has(m.id) && (m.class_id === l.class_id)) ||
      mentors.find((m) => m.id !== l.id && !used.has(m.id))
    if (!mentor) continue
    used.add(mentor.id)
    rows.push({ primary: `${mentor.name} → ${l.name}`, secondary: `멘토 영향력 ${mentor.eig.toFixed(2)} · 학습자 연결 ${l.deg}`, tag: '매칭' })
    if (rows.length >= 8) break
  }
  return {
    headline: rows.length ? `${rows.length}건의 또래 튜터링 매칭을 제안합니다.` : '매칭할 데이터가 부족합니다. 평가를 더 입력하세요.',
    stats: [{ label: '멘토 후보', value: mentors.length }, { label: '제안 매칭', value: rows.length }],
    rows,
  }
}

async function questConflict(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const name = new Map(children.map((c) => [c.id, c.name]))
  const { data } = await sb.from('interactions')
    .select('source_id, target_id, weight')
    .eq('center_id', center).is('deleted_at', null)
    .eq('relation_type', 'conflict').eq('source_kind', 'child').eq('target_kind', 'child')
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const e of data ?? []) {
    const key = [e.source_id, e.target_id].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const a = name.get(e.source_id), b = name.get(e.target_id)
    if (a && b) rows.push({ primary: `${a} ↔ ${b}`, secondary: '좌석·활동 분리 권장', tag: '갈등' })
  }
  return {
    headline: rows.length ? `${rows.length}쌍의 갈등 관계가 감지되었습니다.` : '기록된 갈등 관계가 없습니다.',
    stats: [{ label: '갈등 쌍', value: rows.length }],
    rows,
  }
}

async function questAttendance(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const ids = children.map((c) => c.id)
  const name = new Map(children.map((c) => [c.id, c.name]))
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const { data } = ids.length
    ? await sb.from('attendances').select('child_id, status').in('child_id', ids).gte('attendance_date', since)
    : { data: [] }
  const agg = new Map<string, { present: number; absent: number; late: number }>()
  for (const a of data ?? []) {
    const r = agg.get(a.child_id) ?? { present: 0, absent: 0, late: 0 }
    if (a.status === 'present') r.present++
    else if (a.status === 'absent') r.absent++
    else if (a.status === 'late') r.late++
    agg.set(a.child_id, r)
  }
  const rows: Row[] = []
  let totalAbsent = 0
  for (const [cid, r] of agg) {
    totalAbsent += r.absent
    const total = r.present + r.absent + r.late
    const rate = total ? Math.round((r.absent / total) * 100) : 0
    if (r.absent >= 3 || rate >= 30) rows.push({ primary: name.get(cid) ?? '아동', secondary: `결석 ${r.absent} · 지각 ${r.late} · 결석률 ${rate}%`, tag: rate >= 50 ? '높음' : '주의' })
  }
  rows.sort((a, b) => (b.tag === '높음' ? 1 : 0) - (a.tag === '높음' ? 1 : 0))
  return {
    headline: rows.length ? `${rows.length}명의 출결 관리가 필요합니다.` : '최근 30일 출결 이상 신호가 없습니다.',
    stats: [{ label: '기록 아동', value: agg.size }, { label: '총 결석', value: totalAbsent }],
    rows,
  }
}

// ---- ontology-aware quests (use sna_entities + labeled edges) -------------
async function questAllergy(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const childIds = new Set(children.map((c) => c.id))
  const name = new Map(children.map((c) => [c.id, c.name]))
  const { data: hp } = await sb.from('health_profiles').select('child_id, allergies')
    .eq('center_id', center).is('deleted_at', null)
  const names = await nodeNames(sb, center)
  const ints = await interactions(sb, center)
  // child <-> food edges flagged as allergy/conflict
  const allergyEdges = ints.filter((e) =>
    ((e.source_kind === 'child' && e.target_kind === 'food') || (e.target_kind === 'child' && e.source_kind === 'food')) &&
    (e.relation_type === 'conflict' || (e.label ?? '').includes('알러지')))
  const rows: Row[] = []
  for (const r of hp ?? []) {
    if (!childIds.has(r.child_id)) continue
    const al = (r.allergies ?? '').trim()
    if (!al) continue
    const linked = allergyEdges.filter((e) => e.source_id === r.child_id || e.target_id === r.child_id)
      .map((e) => names.get(e.source_kind === 'food' ? e.source_id : e.target_id)?.name).filter(Boolean)
    rows.push({
      primary: name.get(r.child_id) ?? '아동',
      secondary: `알레르기: ${al}${linked.length ? ` · 식단 주의 식재료: ${[...new Set(linked)].join(', ')}` : ''}`,
      tag: linked.length ? '식단주의' : '확인',
    })
  }
  return {
    headline: rows.length ? `${rows.length}명의 알레르기 관리 대상이 있습니다.` : '등록된 알레르기 정보가 없습니다.',
    stats: [{ label: '알레르기 아동', value: rows.length }, { label: '식단 충돌', value: rows.filter((r) => r.tag === '식단주의').length }],
    rows,
  }
}

async function questAchievement(sb: SB, center: string): Promise<Result> {
  const names = await nodeNames(sb, center)
  const ints = await interactions(sb, center)
  const NEG = ['부족', '보충', '저조', '거부', '요망', '어려']
  const POS = ['우수', '상위', '탁월', '마스터']
  const rows: Row[] = []
  for (const e of ints) {
    const childId = e.source_kind === 'child' ? e.source_id : (e.target_kind === 'child' ? e.target_id : null)
    const achId = e.source_kind === 'achievement' ? e.source_id : (e.target_kind === 'achievement' ? e.target_id : null)
    if (!childId || !achId) continue
    const lbl = e.label ?? ''
    const isNeg = NEG.some((k) => lbl.includes(k))
    if (!isNeg) continue
    rows.push({ primary: names.get(childId)?.name ?? '아동', secondary: `${names.get(achId)?.name ?? '영역'} · ${lbl}`, tag: '보충필요' })
  }
  const strong = ints.filter((e) => {
    const isAch = e.source_kind === 'achievement' || e.target_kind === 'achievement'
    return isAch && POS.some((k) => (e.label ?? '').includes(k))
  }).length
  return {
    headline: rows.length ? `${rows.length}건의 학습 영역 보충 지도가 필요합니다.` : '보충이 필요한 학습 신호가 없습니다.',
    stats: [{ label: '보충 필요', value: rows.length }, { label: '우수 성취', value: strong }],
    rows,
  }
}

async function questSpace(sb: SB, center: string): Promise<Result> {
  const names = await nodeNames(sb, center)
  const ints = await interactions(sb, center)
  const pref = new Map<string, { like: number; avoid: number }>()
  for (const e of ints) {
    const spaceId = e.source_kind === 'space' ? e.source_id : (e.target_kind === 'space' ? e.target_id : null)
    const isChild = e.source_kind === 'child' || e.target_kind === 'child'
    if (!spaceId || !isChild) continue
    const r = pref.get(spaceId) ?? { like: 0, avoid: 0 }
    if ((e.label ?? '').includes('기피') || e.relation_type === 'conflict') r.avoid++
    else r.like++
    pref.set(spaceId, r)
  }
  const rows: Row[] = [...pref.entries()]
    .map(([id, v]) => ({ name: names.get(id)?.name ?? '공간', ...v }))
    .sort((a, b) => (b.like + b.avoid) - (a.like + a.avoid))
    .map((s) => ({ primary: s.name, secondary: `선호 ${s.like}명 · 기피 ${s.avoid}명`, tag: s.avoid > s.like ? '재설계' : '인기' }))
  return {
    headline: rows.length ? `${rows.length}개 공간의 선호/기피 패턴을 분석했습니다.` : '공간 선호 데이터가 없습니다.',
    stats: [{ label: '분석 공간', value: rows.length }, { label: '재설계 권장', value: rows.filter((r) => r.tag === '재설계').length }],
    rows,
  }
}

// ── ontology-aware quests (health_events + WHO vocabularies + SNA) ──────────
// Epidemiological exposure: contagious symptom carriers propagate risk to
// classmates and play/proximity neighbours within a 7-day window (WHO IMCI).
async function questContagion(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const byId = new Map(children.map((c) => [c.id, c]))
  const symLabels = await refLabels(sb, 'symptom')
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  const { data: ev } = await sb.from('health_events')
    .select('child_id, domain, code, label, severity, event_date, contagious, status')
    .eq('center_id', center).is('deleted_at', null).gte('event_date', since)
  const sources = (ev ?? []).filter((e: any) => e.status !== 'resolved' &&
    (e.contagious || (e.domain === 'symptom' && symLabels.get(e.code)?.meta?.contagious) ||
     (e.domain === 'icd11_category' && symLabels.size >= 0 && e.code === 'INFECTIOUS')))
  const edges = (await interactions(sb, center)).filter((e: any) => e.source_kind === 'child' && e.target_kind === 'child')
  const exposure = new Map<string, { paths: Set<string>; symptoms: Set<string>; src: Set<string>; sev: number }>()
  for (const s of sources) {
    const sc = byId.get(s.child_id); if (!sc) continue
    const symLabel = symLabels.get(s.code)?.label ?? s.label ?? '전염성 증상'
    const sevW = s.severity === 'severe' ? 3 : s.severity === 'moderate' ? 2 : 1
    const classmates = children.filter((c) => c.id !== s.child_id && c.class_id && c.class_id === sc.class_id).map((c) => c.id)
    const neigh = edges.filter((e: any) => e.relation_type === 'play' || e.relation_type === 'proximity')
      .filter((e: any) => e.source_id === s.child_id || e.target_id === s.child_id)
      .map((e: any) => (e.source_id === s.child_id ? e.target_id : e.source_id))
    const classSet = new Set(classmates)
    for (const pid of new Set<string>([...classmates, ...neigh])) {
      if (!byId.has(pid)) continue
      const rec = exposure.get(pid) ?? { paths: new Set(), symptoms: new Set(), src: new Set(), sev: 0 }
      rec.paths.add(classSet.has(pid) ? '동일 반' : '또래 접촉')
      rec.symptoms.add(symLabel); rec.src.add(sc.name); rec.sev += sevW
      exposure.set(pid, rec)
    }
  }
  const rows: Row[] = [...exposure.entries()].map(([pid, rec]) => {
    const score = rec.src.size * 2 + rec.paths.size + rec.sev
    return { primary: byId.get(pid)!.name, secondary: `노출 경로 ${[...rec.paths].join('·')} · 감염원 ${[...rec.src].join(', ')} · 증상 ${[...rec.symptoms].join(', ')}`, tag: score >= 6 ? '높음' : '주의', _s: score }
  }).sort((a, b) => (b as any)._s - (a as any)._s).map(({ _s, ...r }: any) => r)
  return {
    headline: rows.length ? `${rows.length}명이 전염성 증상 노출 경로에 있습니다 (WHO IMCI 7일 잠복 기준).` : '최근 7일 전염성 증상 노출 경로가 없습니다.',
    stats: [{ label: '감염원', value: sources.length }, { label: '노출 위험', value: rows.length }, { label: '고위험', value: rows.filter((r) => r.tag === '높음').length }],
    rows,
  }
}

// Allergen safety: coded allergens (Codex/WHO) cross-referenced with food edges.
async function questAllergySafety(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const name = new Map(children.map((c) => [c.id, c.name]))
  const allergen = await refLabels(sb, 'allergen_class')
  const { data: hp } = await sb.from('health_profiles')
    .select('child_id, allergen_codes, allergies').eq('center_id', center).is('deleted_at', null)
  const ints = await interactions(sb, center)
  const foodLinks = ints.filter((e: any) => (e.source_kind === 'food' || e.target_kind === 'food'))
  const rows: Row[] = []
  let coded = 0, foodConflicts = 0
  for (const r of hp ?? []) {
    if (!name.has(r.child_id)) continue
    const codes = (r.allergen_codes ?? []) as string[]
    const free = (r.allergies ?? '').trim()
    if (codes.length === 0 && !free) continue
    if (codes.length) coded++
    const labels = codes.map((c) => allergen.get(c)?.label ?? c)
    const groups = new Set(codes.map((c) => allergen.get(c)?.meta?.group ?? 'other'))
    const linked = foodLinks.some((e: any) => e.source_id === r.child_id || e.target_id === r.child_id)
    if (linked && groups.has('food')) foodConflicts++
    rows.push({
      primary: name.get(r.child_id)!,
      secondary: `표준 알레르겐: ${labels.length ? labels.join(', ') : '(미코딩)'}${free ? ` · 비고 ${free}` : ''}${linked ? ' · 급식 연결 감지' : ''}`,
      tag: linked && groups.has('food') ? '식단주의' : groups.has('medication') ? '투약주의' : '관리',
    })
  }
  return {
    headline: rows.length ? `${rows.length}명의 알레르기 관리 대상 (Codex/WHO 주요 알레르겐 기준).` : '등록된 알레르기 정보가 없습니다.',
    stats: [{ label: '관리 대상', value: rows.length }, { label: '표준 코딩', value: coded }, { label: '급식 충돌', value: foodConflicts }],
    rows,
  }
}

// Developmental support screening (WHO ICF-CY domains).
async function questDevelopmental(sb: SB, center: string): Promise<Result> {
  const children = await activeChildren(sb, center)
  const name = new Map(children.map((c) => [c.id, c.name]))
  const dom = await refLabels(sb, 'developmental_domain')
  const { data: ev } = await sb.from('health_events')
    .select('child_id, domain, code, label, severity, status')
    .eq('center_id', center).is('deleted_at', null).eq('kind', 'screening')
  const rows: Row[] = []
  for (const e of ev ?? []) {
    if (e.domain !== 'developmental_domain' || !name.has(e.child_id) || e.severity === 'mild') continue
    rows.push({ primary: name.get(e.child_id)!, secondary: `${dom.get(e.code)?.label ?? e.label ?? '발달 영역'} · 지원 필요 (${e.severity === 'severe' ? '높음' : '중간'})`, tag: e.severity === 'severe' ? '높음' : '주의' })
  }
  return {
    headline: rows.length ? `${rows.length}건의 발달 지원 권고 (WHO ICF-CY 기준).` : '발달 선별 결과 지원 권고가 없습니다.',
    stats: [{ label: '선별 기록', value: (ev ?? []).length }, { label: '지원 권고', value: rows.length }],
    rows,
  }
}

const RUNNERS: Record<string, (sb: SB, c: string) => Promise<Result>> = {
  isolation_risk: questIsolation,
  tutor_matching: questTutor,
  conflict_watch: questConflict,
  attendance_summary: questAttendance,
  allergy_diet: questAllergy,
  achievement_gap: questAchievement,
  space_preference: questSpace,
  health_contagion: questContagion,
  allergy_safety: questAllergySafety,
  developmental_support: questDevelopmental,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  const body = await req.json().catch(() => ({}))
  const { center_id, quest_id } = body as { center_id?: string; quest_id?: string }
  if (!center_id || !quest_id) return json({ ok: false, error: 'center_id and quest_id required' }, 400)

  const sb = serviceClient()
  try {
    const { data: quest, error: qErr } = await sb.from('analysis_quests')
      .select('*').eq('id', quest_id).eq('center_id', center_id).single()
    if (qErr || !quest) throw new Error('quest not found')

    await sb.from('analysis_quests').update({ status: 'running', error: null }).eq('id', quest_id)

    CURRENT_CLASS = (quest.params && typeof quest.params === 'object' && quest.params.class_id) ? quest.params.class_id : null

    const runner = RUNNERS[quest.quest_type]
    if (!runner) throw new Error(`unknown quest_type: ${quest.quest_type}`)
    const result = await runner(sb, center_id)

    await sb.from('analysis_quests').update({ status: 'done', result, error: null }).eq('id', quest_id)
    return json({ ok: true, result })
  } catch (e) {
    await sb.from('analysis_quests').update({ status: 'error', error: (e as Error).message }).eq('id', quest_id)
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
