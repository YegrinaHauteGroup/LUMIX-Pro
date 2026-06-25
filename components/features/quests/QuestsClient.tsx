'use client'

import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface QuestRow { primary: string; secondary?: string; tag?: string }
interface QuestResult { headline: string; stats: { label: string; value: string | number }[]; rows: QuestRow[] }
interface Quest {
  id: string
  title: string
  quest_type: string
  status: 'pending' | 'running' | 'done' | 'error'
  result: QuestResult | null
  error: string | null
  created_at: string
  updated_at: string
}
interface Props { centerId: string; initialQuests: Quest[] }

const CATALOG: { type: string; title: string; desc: string; bar: string }[] = [
  { type: 'isolation_risk', title: '사회적 고립 위험 탐지', desc: '관계망 고립·연결 부족·결석 신호를 종합해 우선 관찰 대상을 도출합니다.', bar: 'border-l-slate-400' },
  { type: 'tutor_matching', title: '또래 튜터링 매칭', desc: '영향력 높은 아동을 고립·저참여 아동의 멘토로 자동 매칭합니다.', bar: 'border-l-amber-400' },
  { type: 'conflict_watch', title: '갈등 관계 모니터링', desc: '갈등 엣지를 추출해 좌석·활동 분리가 필요한 쌍을 제시합니다.', bar: 'border-l-red-400' },
  { type: 'attendance_summary', title: '출결 이상 분석', desc: '최근 30일 결석·지각 패턴으로 관리가 필요한 아동을 선별합니다.', bar: 'border-l-indigo-400' },
  { type: 'allergy_diet', title: '알레르기·식단 관리', desc: '알레르기 정보와 식재료 엣지를 교차해 식단 충돌을 점검합니다.', bar: 'border-l-emerald-400' },
  { type: 'achievement_gap', title: '학습 성취 보충 분석', desc: '성취 영역 엣지에서 보충 지도가 필요한 신호를 모읍니다.', bar: 'border-l-yellow-400' },
  { type: 'space_preference', title: '공간 선호·기피 분석', desc: '공간별 선호/기피 분포로 환경 재설계 포인트를 찾습니다.', bar: 'border-l-cyan-400' },
]

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-ink-faint bg-fill', running: 'text-info bg-info-soft',
  done: 'text-success bg-success-soft', error: 'text-danger bg-danger-soft',
}
const STATUS_LABEL: Record<string, string> = { pending: '대기', running: '실행 중', done: '완료', error: '오류' }
const TAG_STYLE = (tag?: string) => {
  if (!tag) return 'text-ink-faint bg-fill'
  if (['높음', '갈등', '확진'].some((t) => tag.includes(t))) return 'text-danger bg-danger-soft'
  if (['주의', '식단주의', '보충필요', '재설계'].some((t) => tag.includes(t))) return 'text-warn bg-warn-soft'
  if (['매칭', '인기', '우수'].some((t) => tag.includes(t))) return 'text-success bg-success-soft'
  return 'text-ink-soft bg-fill'
}

export function QuestsClient({ centerId, initialQuests }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [quests, setQuests] = useState<Quest[]>(initialQuests)
  const [type, setType] = useState(CATALOG[0].type)
  const [title, setTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const selected = CATALOG.find((c) => c.type === type)!

  async function runQuest() {
    if (!centerId) return
    setRunning(true); setMsg(null)
    const finalTitle = title.trim() || selected.title
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error: insErr } = await supabase
        .from('analysis_quests')
        .insert({ center_id: centerId, title: finalTitle, quest_type: type, status: 'pending', created_by: user?.id ?? null })
        .select('id, title, quest_type, status, result, error, created_at, updated_at')
        .single()
      if (insErr || !inserted) throw new Error(insErr?.message ?? '퀘스트 생성 실패')

      setQuests((q) => [inserted as Quest, ...q])
      const { error: fnErr } = await supabase.functions.invoke('run_quest', { body: { center_id: centerId, quest_id: inserted.id } })
      if (fnErr) throw new Error(fnErr.message)

      const { data: refreshed } = await supabase
        .from('analysis_quests')
        .select('id, title, quest_type, status, result, error, created_at, updated_at')
        .eq('id', inserted.id).single()
      if (refreshed) setQuests((q) => q.map((x) => (x.id === refreshed.id ? (refreshed as Quest) : x)))
      setTitle('')
      setMsg({ type: 'success', text: '분석이 완료되어 결과가 저장되었습니다.' })
    } catch (e) {
      setMsg({ type: 'error', text: (e as Error).message })
    } finally {
      setRunning(false)
      router.refresh()
    }
  }

  async function removeQuest(id: string) {
    await supabase.from('analysis_quests').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setQuests((q) => q.filter((x) => x.id !== id))
  }

  return (
    <div className="flex-1 p-6 grid grid-cols-[360px_1fr] gap-5 max-w-[1600px] mx-auto w-full overflow-auto">
      {/* Define / run a quest */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>분석 과제 정의</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="block text-[11px] text-ink-faint mb-1.5">분석 유형</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full h-9 px-3 bg-fill-2 border border-line rounded-lg text-[13px] text-ink focus:outline-none focus:border-accent">
                {CATALOG.map((c) => <option key={c.type} value={c.type}>{c.title}</option>)}
              </select>
            </div>
            <p className="text-[12px] text-ink-soft leading-relaxed border-l-[3px] pl-3 py-0.5 border-l-accent/40">{selected.desc}</p>
            <div>
              <label className="block text-[11px] text-ink-faint mb-1.5">과제 제목 (선택)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selected.title}
                className="w-full h-9 px-3 bg-fill-2 border border-line rounded-lg text-[13px] text-ink placeholder-ink-ghost focus:outline-none focus:border-accent" />
            </div>
            {msg && (
              <div className={`px-3 py-2.5 text-[12px] rounded-lg ${msg.type === 'success' ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft'}`}>{msg.text}</div>
            )}
            <Button onClick={runQuest} loading={running} className="w-full" size="lg">분석 실행</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>분석 카탈로그</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {CATALOG.map((c) => (
              <button key={c.type} onClick={() => setType(c.type)}
                className={`w-full text-left px-3 py-2.5 rounded-md border border-line border-l-[3px] ${c.bar} transition-colors ${type === c.type ? 'bg-fill' : 'bg-surface hover:bg-fill'}`}>
                <p className="text-[13px] font-medium text-ink">{c.title}</p>
                <p className="text-[11px] text-ink-faint mt-0.5 leading-snug">{c.desc}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Results history */}
      <div className="space-y-4 min-w-0">
        {quests.length === 0 ? (
          <Card><CardContent><p className="text-[13px] text-ink-faint py-8 text-center">아직 실행된 분석이 없습니다. 왼쪽에서 분석 유형을 선택하고 실행하세요.</p></CardContent></Card>
        ) : (
          quests.map((q) => (
            <Card key={q.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[13px] font-semibold text-ink truncate">{q.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLE[q.status]}`}>{STATUS_LABEL[q.status]}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-ink-ghost">{new Date(q.created_at).toLocaleString('ko-KR')}</span>
                  <button onClick={() => removeQuest(q.id)} className="text-[11px] text-ink-faint hover:text-danger">삭제</button>
                </div>
              </CardHeader>
              <CardContent>
                {q.status === 'error' && <p className="text-[12px] text-danger">{q.error}</p>}
                {q.status !== 'error' && q.result && (
                  <div className="space-y-4">
                    <p className="text-[13px] text-ink font-medium">{q.result.headline}</p>
                    {q.result.stats?.length > 0 && (
                      <div className="flex gap-3">
                        {q.result.stats.map((s, i) => (
                          <div key={i} className="px-4 py-2.5 bg-fill-2 border border-line rounded-lg">
                            <p className="text-[10px] text-ink-faint uppercase tracking-[0.1em]">{s.label}</p>
                            <p className="text-[18px] font-semibold text-ink mt-0.5">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.result.rows?.length > 0 && (
                      <div className="border border-line rounded-lg divide-y divide-line">
                        {q.result.rows.map((r, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[12.5px] text-ink font-medium truncate">{r.primary}</p>
                              {r.secondary && <p className="text-[11px] text-ink-faint mt-0.5 truncate">{r.secondary}</p>}
                            </div>
                            {r.tag && <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${TAG_STYLE(r.tag)}`}>{r.tag}</span>}
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
          ))
        )}
      </div>
    </div>
  )
}
