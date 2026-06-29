'use client'

import { createClient } from '@/utils/supabase/client'
import { withTimeout } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FlaskConical, Play, Trash2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PipelineCanvas } from './PipelineCanvas'
import { AddToWorkspaceButton } from '@/components/workspace/AddToWorkspaceButton'

interface QuestRow { primary: string; secondary?: string; tag?: string }
interface QuestResult { headline: string; stats: { label: string; value: string | number }[]; rows: QuestRow[] }
interface Quest {
  id: string; title: string; quest_type: string; params: Record<string, unknown> | null
  status: 'pending' | 'running' | 'done' | 'error'; result: QuestResult | null; error: string | null
  created_at: string; updated_at: string
}
interface Insights {
  summary?: { children: number; isolated: number; communities: number; avg_betweenness: number }
  isolated?: unknown[]; conflict_children?: unknown[]; allergy_children?: unknown[]; most_influential?: unknown[]
  entities?: Record<string, number>
}
interface ClassOpt { id: string; name: string; count: number }
interface Props {
  centerId: string; initialQuests: Quest[]; insights: Insights | null
  classes: ClassOpt[]; staffCount: number; entityCount: number
}

const CATALOG: { type: string; title: string; desc: string }[] = [
  { type: 'isolation_risk', title: '사회적 고립 위험 탐지', desc: '관계망 고립·연결 부족·결석 신호를 종합해 우선 관찰 대상을 도출합니다.' },
  { type: 'tutor_matching', title: '또래 튜터링 매칭', desc: '영향력 높은 아동을 고립·저참여 아동의 멘토로 자동 매칭합니다.' },
  { type: 'conflict_watch', title: '갈등 관계 모니터링', desc: '갈등 엣지를 추출해 좌석·활동 분리가 필요한 쌍을 제시합니다.' },
  { type: 'attendance_summary', title: '출결 이상 분석', desc: '최근 30일 결석·지각 패턴으로 관리가 필요한 아동을 선별합니다.' },
  { type: 'allergy_diet', title: '알레르기·식단 관리', desc: '알레르기 정보와 식재료 엣지를 교차해 식단 충돌을 점검합니다.' },
  { type: 'achievement_gap', title: '학습 성취 보충 분석', desc: '성취 영역 엣지에서 보충 지도가 필요한 신호를 모읍니다.' },
  { type: 'space_preference', title: '공간 선호·기피 분석', desc: '공간별 선호/기피 분포로 환경 재설계 포인트를 찾습니다.' },
  { type: 'health_contagion', title: '전염성 질환 확산 분석 · WHO IMCI', desc: 'WHO IMCI 증상 기록과 SNA 근접·반 구조를 결합해 7일 잠복 기준 노출 위험 아동을 도출합니다.' },
  { type: 'allergy_safety', title: '알레르겐 안전 점검 · Codex/WHO', desc: 'Codex/WHO 주요 알레르겐 코드와 급식 식재료 연결을 교차해 식단·투약 충돌을 점검합니다.' },
  { type: 'developmental_support', title: '발달 지원 선별 · WHO ICF-CY', desc: 'WHO ICF-CY 발달 영역 선별 기록에서 지원이 필요한 아동을 선별합니다.' },
  { type: 'hub_collapse', title: '허브 붕괴 시뮬레이션 · 결속 퀘스트', desc: '매개 중심성 최상위 중재자 아동 부재 시 관계망 분열을 시뮬레이션해 고립 위험 아동을 추출하고 사회성 결속(Bridge Building) 퀘스트를 자동 발행합니다.' },
]
const SENS: Record<string, { label: string; factor: number }> = {
  low: { label: '보수적', factor: 0.7 }, normal: { label: '표준', factor: 1 }, high: { label: '민감', factor: 1.3 },
}
// Data keys / variables each analysis pulls from the database — the user can
// toggle which signals feed the pipeline toward their goal.
const KEYS: Record<string, string[]> = {
  isolation_risk: ['관계망 고립', '연결 수(degree)', '최근 30일 결석', '커뮤니티 단절'],
  tutor_matching: ['영향력(eigenvector)', '고립도', '같은 반', '학습 수준'],
  conflict_watch: ['갈등 엣지', '좌석/활동 인접', '반복 빈도'],
  attendance_summary: ['결석 횟수', '지각 횟수', '조퇴', '결석률'],
  allergy_diet: ['알레르기 프로필', '급식 식재료 엣지'],
  achievement_gap: ['성취 영역', '보충 신호', '우수 신호'],
  space_preference: ['공간 선호', '공간 기피'],
  health_contagion: ['전염성 증상(IMCI)', '동일 반', '근접 접촉', '7일 잠복'],
  allergy_safety: ['알레르겐 코드(Codex)', '급식 연결', '투약 충돌'],
  developmental_support: ['ICF-CY 영역', '선별 등급'],
  hub_collapse: ['매개 중심성', '컴포넌트 분열', '고립 위험도', '결속 퀘스트'],
}
// Natural-language goal → quest type
const GOAL_RULES: { re: RegExp; type: string }[] = [
  { re: /허브|중재자|붕괴|결속|네트워크.*분열/, type: 'hub_collapse' },
  { re: /멘토|튜터|또래.*도움|짝꿍|짝/, type: 'tutor_matching' },
  { re: /고립|외톨이|혼자|친구\s*없|소외/, type: 'isolation_risk' },
  { re: /갈등|다툼|싸움|분쟁|괴롭/, type: 'conflict_watch' },
  { re: /전염|감염|질병|확산|독감|유행/, type: 'health_contagion' },
  { re: /알레르|알러지|식단|급식/, type: 'allergy_safety' },
  { re: /발달|지연|선별|ICF/, type: 'developmental_support' },
  { re: /성취|학습|보충|학력|성적/, type: 'achievement_gap' },
  { re: /공간|교실|놀이방|환경/, type: 'space_preference' },
  { re: /결석|출결|지각|조퇴/, type: 'attendance_summary' },
]
const inferType = (goal: string) => GOAL_RULES.find((r) => r.re.test(goal))?.type ?? 'isolation_risk'
const STATUS_STYLE: Record<string, string> = {
  pending: 'text-ink-faint bg-fill', running: 'text-info bg-info-soft', done: 'text-success bg-success-soft', error: 'text-danger bg-danger-soft',
}
const STATUS_LABEL: Record<string, string> = { pending: '대기', running: '실행 중', done: '완료', error: '오류' }
const TAG_STYLE = (tag?: string) => {
  if (!tag) return 'text-ink-faint bg-fill'
  if (['높음', '갈등', '확진'].some((t) => tag.includes(t))) return 'text-danger bg-danger-soft'
  if (['주의', '식단주의', '보충필요', '재설계'].some((t) => tag.includes(t))) return 'text-warn bg-warn-soft'
  if (['매칭', '인기', '우수'].some((t) => tag.includes(t))) return 'text-success bg-success-soft'
  return 'text-ink-soft bg-fill'
}

export function QuestsClient({ centerId, initialQuests, insights, classes, staffCount, entityCount }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [quests, setQuests] = useState<Quest[]>(initialQuests)
  const [type, setType] = useState(CATALOG[0].type)
  const [scope, setScope] = useState('ALL')
  const [sensitivity, setSensitivity] = useState('normal')
  const [title, setTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [sim, setSim] = useState<{ pool: number; estimate: number; label: string; note: string } | null>(null)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [goal, setGoal] = useState('')
  const [keys, setKeys] = useState<string[]>(KEYS[CATALOG[0].type])
  const [goalMsg, setGoalMsg] = useState<string | null>(null)

  // Switching quest type resets the selected data keys to that type's full set.
  function changeType(v: string) { setType(v); setKeys(KEYS[v] ?? []); setSim(null) }
  function applyGoal(e: React.FormEvent) {
    e.preventDefault()
    const g = goal.trim()
    if (!g) return
    const t = inferType(g)
    changeType(t)
    setTitle(g)
    const label = CATALOG.find((c) => c.type === t)?.title ?? t
    setGoalMsg(`목표를 분석해 "${label}" 파이프라인을 구성했습니다. 변수와 범위를 조정한 뒤 시뮬레이션·실행하세요.`)
  }
  const toggleKey = (k: string) => setKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  const selected = CATALOG.find((c) => c.type === type)!
  const totalChildren = insights?.summary?.children ?? 0
  const scopeClass = classes.find((c) => c.id === scope)
  const scopeName = scope === 'ALL' ? '전체 센터' : scopeClass?.name ?? '선택 반'
  const scopeFactor = scope === 'ALL' || !totalChildren ? 1 : Math.max(0.05, (scopeClass?.count ?? 0) / totalChildren)

  function simulate() {
    const f = SENS[sensitivity].factor * scopeFactor
    const pool = Math.max(0, Math.round((scope === 'ALL' ? totalChildren : (scopeClass?.count ?? 0))))
    const ins = insights ?? {}
    let estimate = 0, label = '예상 대상', note = ''
    switch (type) {
      case 'isolation_risk':
        estimate = Math.round((ins.summary?.isolated ?? 0) * SENS[sensitivity].factor * scopeFactor); label = '예상 고립 위험'; note = '관계망 고립 + 결석 신호 종합'; break
      case 'tutor_matching':
        estimate = Math.round(Math.min(ins.most_influential?.length ?? 0, ins.isolated?.length ?? 0) * scopeFactor); label = '예상 매칭'; note = '멘토 후보 × 고립 학습자'; break
      case 'conflict_watch':
        estimate = Math.round(((ins.conflict_children?.length ?? 0) / 2) * f); label = '예상 갈등 쌍'; note = '갈등 엣지 기반'; break
      case 'allergy_diet':
        estimate = Math.round((ins.allergy_children?.length ?? 0) * scopeFactor); label = '관리 대상'; note = '알레르기 프로필 + 식재료 엣지'; break
      case 'achievement_gap':
        estimate = ins.entities?.achievement ?? 0; label = '점검 성취 영역'; note = '성취 영역 노드 전수 점검'; break
      case 'space_preference':
        estimate = ins.entities?.space ?? 0; label = '분석 공간'; note = '공간 노드 선호/기피 분포'; break
      case 'attendance_summary':
        estimate = Math.round(pool * 0.15 * SENS[sensitivity].factor); label = '예상 관리 대상'; note = '최근 30일 결석률 기반 추정'; break
      case 'health_contagion':
        estimate = Math.round(pool * 0.1 * f); label = '예상 노출 위험'; note = 'WHO IMCI 증상 + SNA 근접 (실행 시 건강 이벤트로 정밀 산출)'; break
      case 'allergy_safety':
        estimate = Math.round((ins.allergy_children?.length ?? 0) * scopeFactor); label = '관리 대상'; note = 'Codex/WHO 알레르겐 코드 기반'; break
      case 'developmental_support':
        estimate = Math.round(pool * 0.12 * SENS[sensitivity].factor); label = '지원 권고'; note = 'WHO ICF-CY 발달 선별 기록'; break
      case 'hub_collapse':
        estimate = Math.round((ins.summary?.isolated ?? 0) + pool * 0.05); label = '예상 고립 위험'; note = '허브 부재 시 매개 중심성 기반 네트워크 분열 시뮬레이션'; break
    }
    setSim({ pool, estimate, label, note })
  }

  async function execute() {
    if (!centerId || running) return
    setRunning(true); setMsg(null)
    const finalTitle = title.trim() || `${selected.title} · ${scopeName}`
    const params = { class_id: scope === 'ALL' ? null : scope, scope_name: scopeName, sensitivity, keys, goal: goal.trim() || null }
    try {
      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 15000)
      const { data: inserted, error: insErr } = await withTimeout(supabase.from('analysis_quests')
        .insert({ center_id: centerId, title: finalTitle, quest_type: type, params, status: 'pending', created_by: user?.id ?? null })
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').single(), 15000)
      if (insErr || !inserted) throw new Error(insErr?.message ?? '퀘스트 생성 실패')
      setQuests((q) => [inserted as Quest, ...q])
      const { error: fnErr } = await withTimeout(supabase.functions.invoke('run_quest', { body: { center_id: centerId, quest_id: inserted.id } }), 45000)
      if (fnErr) throw new Error(fnErr.message)
      const { data: refreshed } = await withTimeout(supabase.from('analysis_quests')
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').eq('id', inserted.id).single(), 15000)
      if (refreshed) setQuests((q) => q.map((x) => x.id === refreshed.id ? (refreshed as Quest) : x))
      setMsg({ type: 'success', text: '파이프라인 실행이 완료되어 결과가 저장되었습니다.' })
      setTitle('')
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message })
    } finally {
      // No router.refresh(): results are applied optimistically; refreshing here
      // re-runs the heavy SNA insights query and stalls the UI after each run.
      setRunning(false)
    }
  }

  async function removeQuest(id: string) {
    await supabase.from('analysis_quests').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuests((q) => q.filter((x) => x.id !== id))
  }

  return (
    <div className="flex-1 min-h-0 p-3 w-full flex flex-col gap-2.5 overflow-hidden">
      {/* GOAL BAR — natural-language goal seeds the pipeline */}
      <form onSubmit={applyGoal} className="shrink-0 bg-surface border border-line rounded-[3px] px-3 py-2 flex items-center gap-2.5">
        <Sparkles size={16} className="text-accent shrink-0" />
        <input value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="분석 목표를 입력하세요 — 예: 고립 위험 아동을 찾아줘 · 갈등 관계를 줄이고 싶어 · 전염병 확산을 막고 싶어"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder-ink-ghost focus:outline-none" />
        <Button type="submit" size="sm"><Sparkles size={13} /> 목표로 파이프라인 구성</Button>
      </form>
      {goalMsg && <div className="shrink-0 text-[11.5px] text-accent bg-accent-soft px-3 py-2 rounded-[3px]">{goalMsg}</div>}

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
      {/* LEFT — interactive pipeline canvas + configuration */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
        <PipelineCanvas
          centerId={centerId} classes={classes} insights={insights}
          staffCount={staffCount} entityCount={entityCount}
          questType={type} scope={scope}
          onQuestType={(v) => changeType(v)} onScope={(v) => { setScope(v); setSim(null) }}
          onResult={(q) => setQuests((prev) => [q as unknown as Quest, ...prev.filter((x) => x.id !== q.id)])}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Config — synced with the canvas analysis/filter nodes */}
          <Card>
            <CardHeader><CardTitle>퀘스트 구성 · 캔버스 연동</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              <div>
                <label className="block text-[11px] text-ink-faint mb-1.5">분석 유형</label>
                <select value={type} onChange={(e) => changeType(e.target.value)}
                  className="w-full h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink focus:outline-none focus:border-accent">
                  {CATALOG.map((c) => <option key={c.type} value={c.type}>{c.title}</option>)}
                </select>
              </div>
              <p className="text-[12px] text-ink-soft leading-relaxed border-l-[3px] pl-3 py-0.5 border-l-accent/50">{selected.desc}</p>
              <div>
                <label className="block text-[11px] text-ink-faint mb-1.5">분석 변수 · 사용할 데이터 키 <span className="text-ink-ghost">({keys.length}/{(KEYS[type] ?? []).length})</span></label>
                <div className="flex flex-wrap gap-1">
                  {(KEYS[type] ?? []).map((k) => {
                    const on = keys.includes(k)
                    return (
                      <button key={k} type="button" onClick={() => toggleKey(k)}
                        className={`px-2 py-1 rounded-[3px] text-[11px] border transition-colors ${on ? 'bg-accent-soft text-accent border-accent/40' : 'text-ink-faint border-line hover:bg-fill'}`}>
                        {on ? '✓ ' : ''}{k}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-ink-faint mb-1.5">분석 범위</label>
                  <select value={scope} onChange={(e) => { setScope(e.target.value); setSim(null) }}
                    className="w-full h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink focus:outline-none focus:border-accent">
                    <option value="ALL">전체 센터</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-faint mb-1.5">민감도</label>
                  <select value={sensitivity} onChange={(e) => { setSensitivity(e.target.value); setSim(null) }}
                    className="w-full h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink focus:outline-none focus:border-accent">
                    {Object.entries(SENS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-ink-faint mb-1.5">퀘스트 제목 (선택)</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${selected.title} · ${scopeName}`}
                  className="w-full h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink placeholder-ink-ghost focus:outline-none focus:border-accent" />
              </div>
              {msg && <div className={`px-3 py-2.5 text-[12px] rounded-[3px] ${msg.type === 'success' ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft'}`}>{msg.text}</div>}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={simulate}><FlaskConical size={13} /> 시뮬레이션</Button>
                <Button className="flex-1" loading={running} onClick={execute}><Play size={13} /> 실행</Button>
              </div>
            </CardContent>
          </Card>

          {/* Simulation preview + decision support */}
          <Card>
            <CardHeader><CardTitle>시뮬레이션 · 의사결정 지원</CardTitle></CardHeader>
            <CardContent>
              {sim ? (
                <>
                  <div className="flex items-end gap-3 mb-2">
                    <p className="text-3xl font-semibold text-accent leading-none">{sim.estimate}</p>
                    <p className="text-[12px] text-ink-faint pb-1">{sim.label} · 모집단 {sim.pool}명</p>
                  </div>
                  <div className="h-2 bg-fill rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-accent" style={{ width: `${sim.pool ? Math.min(100, (sim.estimate / sim.pool) * 100) : 0}%` }} />
                  </div>
                  <p className="text-[11px] text-ink-soft">{sim.note}</p>
                  <div className="mt-2.5 border-t border-line pt-2.5 space-y-1.5">
                    <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">의사결정 권고</p>
                    <p className="text-[12px] text-ink-soft leading-relaxed">
                      {sim.pool === 0 ? '대상 데이터가 부족합니다. 평가·관계 입력을 먼저 보강하세요.'
                        : sim.estimate === 0 ? `${scopeName}에서 ${selected.title} 신호가 감지되지 않았습니다. 민감도를 높여 재시뮬레이션하거나 범위를 넓혀보세요.`
                        : sim.estimate / Math.max(1, sim.pool) >= 0.3 ? `모집단의 ${Math.round((sim.estimate / sim.pool) * 100)}%가 해당됩니다. 우선 개입이 권장됩니다 — 실행 후 보고서의 상위 대상부터 조치하세요.`
                        : `모집단의 ${Math.round((sim.estimate / sim.pool) * 100)}% 수준입니다. 실행하여 개별 대상을 확정하세요.`}
                    </p>
                    <p className="text-[10px] text-ink-ghost">사용 변수: {keys.join(' · ') || '없음'}</p>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center">
                  <FlaskConical size={24} className="text-ink-ghost mx-auto mb-2" />
                  <p className="text-[12px] text-ink-faint">목표를 입력하거나 유형·변수를 조정한 뒤 <span className="text-accent font-medium">시뮬레이션</span>을 실행하면, 예상 결과와 의사결정 권고가 표시됩니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RIGHT — analysis reports (section scrolls internally, page does not) */}
      <div className="w-[300px] xl:w-[340px] shrink-0 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">분석 보고서</h2>
          <span className="text-[11px] text-ink-faint font-data tabular-nums">{quests.length}건</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
          {quests.length === 0 ? (
            <Card><CardContent><p className="text-[13px] text-ink-faint py-8 text-center">아직 실행된 퀘스트가 없습니다. 좌측에서 구성 후 시뮬레이션·실행하세요.</p></CardContent></Card>
          ) : quests.map((q) => (
            <Card key={q.id}>
              <CardHeader className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold text-ink break-keep line-clamp-2 leading-snug">{q.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] whitespace-nowrap shrink-0 ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-ink-ghost whitespace-nowrap">{new Date(q.created_at).toLocaleString('ko-KR')}</span>
                  {q.result && (
                    <AddToWorkspaceButton source="퀘스트 분석" title={q.title} subtitle={q.result.headline}
                      fields={[
                        ...q.result.stats.map((s) => ({ label: String(s.label), value: String(s.value) })),
                        ...q.result.rows.slice(0, 5).map((r) => ({ label: r.primary, value: r.secondary ?? r.tag ?? '' })),
                      ]}
                      href="/quests" accent="#137cbd" />
                  )}
                  <button onClick={() => removeQuest(q.id)} className="text-ink-ghost hover:text-danger"><Trash2 size={13} /></button>
                </div>
              </CardHeader>
              <CardContent>
                {q.status === 'error' && <p className="text-[12px] text-danger">{q.error}</p>}
                {q.status !== 'error' && q.result && (
                  <div className="space-y-4">
                    <p className="text-[13px] text-ink font-medium">{q.result.headline}</p>
                    {q.result.stats?.length > 0 && (
                      <div className="flex gap-3 flex-wrap">
                        {q.result.stats.map((st, i) => (
                          <div key={i} className="px-4 py-2.5 bg-fill-2 border border-line rounded-[3px]">
                            <p className="text-[10px] text-ink-faint uppercase tracking-[0.1em]">{st.label}</p>
                            <p className="text-[18px] font-semibold text-ink mt-0.5">{st.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.result.rows?.length > 0 && (
                      <div className="border border-line rounded-[3px] divide-y divide-line">
                        {q.result.rows.map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[12.5px] text-ink font-medium truncate">{r.primary}</p>
                              {r.secondary && <p className="text-[11px] text-ink-faint mt-0.5 truncate">{r.secondary}</p>}
                            </div>
                            {r.tag && <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] shrink-0 ${TAG_STYLE(r.tag)}`}>{r.tag}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.result.rows?.length === 0 && <p className="text-[12px] text-ink-faint">해당 신호가 발견되지 않았습니다.</p>}
                  </div>
                )}
                {q.status === 'pending' && <p className="text-[12px] text-ink-faint">대기 중…</p>}
                {q.status === 'running' && <p className="text-[12px] text-info">분석 실행 중…</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
