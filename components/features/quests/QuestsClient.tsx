'use client'

import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Database, Filter, FlaskConical, Play, BarChart3, ChevronRight, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PipelineCanvas } from './PipelineCanvas'

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
]
const SENS: Record<string, { label: string; factor: number }> = {
  low: { label: '보수적', factor: 0.7 }, normal: { label: '표준', factor: 1 }, high: { label: '민감', factor: 1.3 },
}
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
  const router = useRouter()
  const [quests, setQuests] = useState<Quest[]>(initialQuests)
  const [type, setType] = useState(CATALOG[0].type)
  const [scope, setScope] = useState('ALL')
  const [sensitivity, setSensitivity] = useState('normal')
  const [title, setTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [sim, setSim] = useState<{ pool: number; estimate: number; label: string; note: string } | null>(null)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

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
    }
    setSim({ pool, estimate, label, note })
  }

  async function execute() {
    if (!centerId) return
    setRunning(true); setMsg(null)
    const finalTitle = title.trim() || `${selected.title} · ${scopeName}`
    const params = { class_id: scope === 'ALL' ? null : scope, scope_name: scopeName, sensitivity }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error: insErr } = await supabase.from('analysis_quests')
        .insert({ center_id: centerId, title: finalTitle, quest_type: type, params, status: 'pending', created_by: user?.id ?? null })
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').single()
      if (insErr || !inserted) throw new Error(insErr?.message ?? '퀘스트 생성 실패')
      setQuests((q) => [inserted as Quest, ...q])
      const { error: fnErr } = await supabase.functions.invoke('run_quest', { body: { center_id: centerId, quest_id: inserted.id } })
      if (fnErr) throw new Error(fnErr.message)
      const { data: refreshed } = await supabase.from('analysis_quests')
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').eq('id', inserted.id).single()
      if (refreshed) setQuests((q) => q.map((x) => x.id === refreshed.id ? (refreshed as Quest) : x))
      setMsg({ type: 'success', text: '파이프라인 실행이 완료되어 결과가 저장되었습니다.' })
      setTitle('')
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message })
    } finally {
      setRunning(false); router.refresh()
    }
  }

  async function removeQuest(id: string) {
    await supabase.from('analysis_quests').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuests((q) => q.filter((x) => x.id !== id))
  }

  const STAGES = [
    { icon: Database, title: '데이터 소스', body: `아동 ${totalChildren} · 교사 ${staffCount} · SNA노드 ${entityCount} · 환경` },
    { icon: Filter, title: '조건 설정', body: `${selected.title} · ${scopeName} · ${SENS[sensitivity].label}` },
    { icon: FlaskConical, title: '시뮬레이션', body: sim ? `${sim.label} ${sim.estimate} / ${sim.pool}명` : '미실행' },
    { icon: Play, title: '실행 엔진', body: running ? '실행 중…' : 'Edge Function' },
    { icon: BarChart3, title: '결과', body: `${quests.filter((q) => q.status === 'done').length}건 저장` },
  ]

  return (
    <div className="flex-1 min-h-0 p-5 w-full space-y-4 overflow-auto">
      {/* Interactive pipeline canvas */}
      <PipelineCanvas
        centerId={centerId} classes={classes} insights={insights}
        staffCount={staffCount} entityCount={entityCount}
        onResult={(q) => setQuests((prev) => [q as unknown as Quest, ...prev.filter((x) => x.id !== q.id)])}
      />

      {/* Pipeline summary strip */}
      <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
        {STAGES.map((s, i) => (
          <div key={s.title} className="flex items-center shrink-0">
            <div className="w-[210px] bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] px-3.5 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <s.icon size={14} className="text-accent" />
                <span className="text-[11px] font-semibold text-ink uppercase tracking-wider">{s.title}</span>
              </div>
              <p className="text-[11px] text-ink-soft leading-snug">{s.body}</p>
            </div>
            {i < STAGES.length - 1 && <ChevronRight size={16} className="text-ink-ghost mx-1 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[380px_1fr] gap-4">
        {/* Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>퀘스트 구성</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-[11px] text-ink-faint mb-1.5">분석 유형</label>
                <select value={type} onChange={(e) => { setType(e.target.value); setSim(null) }}
                  className="w-full h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink focus:outline-none focus:border-accent">
                  {CATALOG.map((c) => <option key={c.type} value={c.type}>{c.title}</option>)}
                </select>
              </div>
              <p className="text-[12px] text-ink-soft leading-relaxed border-l-[3px] pl-3 py-0.5 border-l-accent/50">{selected.desc}</p>
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

          {/* Simulation preview */}
          {sim && (
            <Card>
              <CardHeader><CardTitle>시뮬레이션 미리보기</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 mb-2">
                  <p className="text-3xl font-semibold text-accent leading-none">{sim.estimate}</p>
                  <p className="text-[12px] text-ink-faint pb-1">{sim.label} · 모집단 {sim.pool}명</p>
                </div>
                <div className="h-2 bg-fill rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-accent" style={{ width: `${sim.pool ? Math.min(100, (sim.estimate / sim.pool) * 100) : 0}%` }} />
                </div>
                <p className="text-[11px] text-ink-soft">{sim.note}</p>
                <p className="text-[10.5px] text-ink-ghost mt-1.5">실제 실행 시 SNA·보건·출결·환경 데이터를 종합해 정밀 산출됩니다.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results history */}
        <div className="space-y-4 min-w-0">
          {quests.length === 0 ? (
            <Card><CardContent><p className="text-[13px] text-ink-faint py-8 text-center">아직 실행된 퀘스트가 없습니다. 좌측에서 구성 후 시뮬레이션·실행하세요.</p></CardContent></Card>
          ) : quests.map((q) => (
            <Card key={q.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[13px] font-semibold text-ink truncate">{q.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-ink-ghost">{new Date(q.created_at).toLocaleString('ko-KR')}</span>
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
  )
}
