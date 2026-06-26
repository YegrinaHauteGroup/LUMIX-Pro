'use client'

import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/Button'
import { Database, Filter, FlaskConical, GitBranch, Play, Plus, Trash2, BarChart3, Link2, Move } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

type NType = 'source' | 'filter' | 'analysis' | 'sim' | 'output'
interface PNode {
  id: string; type: NType; x: number; y: number
  questType?: string; scope?: string
  result?: { headline: string; stats: { label: string; value: string | number }[] } | null
  sim?: number | null
}
interface Edge { from: string; to: string }
interface ClassOpt { id: string; name: string; count: number }
interface Insights { summary?: { children: number; isolated: number }; conflict_children?: unknown[]; allergy_children?: unknown[]; most_influential?: unknown[]; isolated?: unknown[]; entities?: Record<string, number> }

const QUEST_TYPES: { v: string; t: string }[] = [
  { v: 'isolation_risk', t: '고립 위험 탐지' }, { v: 'tutor_matching', t: '또래 튜터링' },
  { v: 'conflict_watch', t: '갈등 모니터링' }, { v: 'attendance_summary', t: '출결 이상' },
  { v: 'allergy_diet', t: '알레르기·식단' }, { v: 'achievement_gap', t: '성취 보충' },
  { v: 'space_preference', t: '공간 선호' },
  { v: 'health_contagion', t: '전염성 확산 (WHO IMCI)' }, { v: 'allergy_safety', t: '알레르겐 안전 (Codex/WHO)' },
  { v: 'developmental_support', t: '발달 지원 (WHO ICF-CY)' },
]
const NODE_META: Record<NType, { label: string; icon: typeof Database; color: string }> = {
  source: { label: '데이터 소스', icon: Database, color: '#137cbd' },
  filter: { label: '범위 필터', icon: Filter, color: '#0f9960' },
  analysis: { label: '분석 엔진', icon: GitBranch, color: '#8b5cf6' },
  sim: { label: '시뮬레이션', icon: FlaskConical, color: '#d9822b' },
  output: { label: '결과 출력', icon: BarChart3, color: '#5c7080' },
}
const NW = 184, NH = 78

let idc = 100
const nid = () => `n${idc++}`

interface Props {
  centerId: string; classes: ClassOpt[]; insights: Insights | null
  staffCount: number; entityCount: number
  onResult: (quest: { id: string; title: string; quest_type: string; params: Record<string, unknown> | null; status: 'pending' | 'running' | 'done' | 'error'; result: never; error: string | null; created_at: string; updated_at: string }) => void
}

export function PipelineCanvas({ centerId, classes, insights, staffCount, entityCount, onResult }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<PNode[]>([
    { id: 'src', type: 'source', x: 30, y: 40 },
    { id: 'flt', type: 'filter', x: 250, y: 40, scope: 'ALL' },
    { id: 'ana', type: 'analysis', x: 470, y: 40, questType: 'isolation_risk' },
    { id: 'sim', type: 'sim', x: 690, y: 150, sim: null },
    { id: 'out', type: 'output', x: 690, y: 40, result: null },
  ])
  const [edges, setEdges] = useState<Edge[]>([
    { from: 'src', to: 'flt' }, { from: 'flt', to: 'ana' }, { from: 'ana', to: 'out' }, { from: 'ana', to: 'sim' },
  ])
  const [selected, setSelected] = useState<string | null>('ana')
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; pid: number; el: Element | null } | null>(null)

  const totalChildren = insights?.summary?.children ?? 0

  function onPointerDownNode(e: React.PointerEvent, n: PNode) {
    if (connectFrom !== null) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    // Capture on the node container (currentTarget), never an inner <svg>/<path>:
    // setPointerCapture on SVG sub-elements throws in Firefox/Safari.
    const el = e.currentTarget as HTMLElement
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y, pid: e.pointerId, el }
    setSelected(n.id)
    try { el.setPointerCapture(e.pointerId) } catch { /* not all targets support capture */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width - NW, e.clientX - rect.left - drag.current.dx))
    const y = Math.max(0, Math.min(rect.height - NH, e.clientY - rect.top - drag.current.dy))
    setNodes((ns) => ns.map((nn) => nn.id === drag.current!.id ? { ...nn, x, y } : nn))
  }
  function onPointerUp() {
    const d = drag.current
    if (d?.el) { try { (d.el as HTMLElement).releasePointerCapture?.(d.pid) } catch { /* already released */ } }
    drag.current = null
  }

  function clickNode(n: PNode) {
    if (connectFrom === null) { setSelected(n.id); return }
    if (connectFrom !== n.id) {
      setEdges((es) => es.some((x) => x.from === connectFrom && x.to === n.id) ? es : [...es, { from: connectFrom!, to: n.id }])
    }
    setConnectFrom(null)
  }

  function addNode(type: NType) {
    const n: PNode = { id: nid(), type, x: 60 + Math.random() * 120, y: 180 + Math.random() * 60 }
    if (type === 'filter') n.scope = 'ALL'
    if (type === 'analysis') n.questType = 'isolation_risk'
    setNodes((ns) => [...ns, n]); setSelected(n.id)
  }
  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id))
    if (selected === id) setSelected(null)
  }
  function patchNode(id: string, patch: Partial<PNode>) { setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...patch } : n)) }

  function estimate(questType: string, scope: string): number {
    const f = scope === 'ALL' || !totalChildren ? 1 : Math.max(0.05, (classes.find((c) => c.id === scope)?.count ?? 0) / totalChildren)
    const ins = insights ?? {}
    switch (questType) {
      case 'isolation_risk': return Math.round((ins.summary?.isolated ?? 0) * f)
      case 'tutor_matching': return Math.round(Math.min(ins.most_influential?.length ?? 0, ins.isolated?.length ?? 0) * f)
      case 'conflict_watch': return Math.round(((ins.conflict_children?.length ?? 0) / 2) * f)
      case 'allergy_diet': return Math.round((ins.allergy_children?.length ?? 0) * f)
      case 'achievement_gap': return ins.entities?.achievement ?? 0
      case 'space_preference': return ins.entities?.space ?? 0
      default: return Math.round((scope === 'ALL' ? totalChildren : (classes.find((c) => c.id === scope)?.count ?? 0)) * 0.15)
    }
  }

  function runSim() {
    const ana = nodes.find((n) => n.type === 'analysis')
    const flt = nodes.find((n) => n.type === 'filter')
    if (!ana) return
    const est = estimate(ana.questType ?? 'isolation_risk', flt?.scope ?? 'ALL')
    setNodes((ns) => ns.map((n) => n.type === 'sim' ? { ...n, sim: est } : n))
  }

  async function runPipeline() {
    const ana = nodes.find((n) => n.type === 'analysis')
    const flt = nodes.find((n) => n.type === 'filter')
    if (!ana) { setRunMsg({ type: 'error', text: '분석 엔진 노드가 필요합니다.' }); return }
    if (!centerId) { setRunMsg({ type: 'error', text: '센터 정보를 찾을 수 없습니다.' }); return }
    setRunning(true); setRunMsg(null)
    runSim()
    const scope = flt?.scope ?? 'ALL'
    const qt = ana.questType ?? 'isolation_risk'
    const params = { class_id: scope === 'ALL' ? null : scope, scope_name: scope === 'ALL' ? '전체 센터' : classes.find((c) => c.id === scope)?.name ?? '', sensitivity: 'normal', via: 'pipeline' }
    const title = `[파이프라인] ${QUEST_TYPES.find((q) => q.v === qt)?.t ?? qt} · ${params.scope_name}`
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error } = await supabase.from('analysis_quests')
        .insert({ center_id: centerId, title, quest_type: qt, params, status: 'pending', created_by: user?.id ?? null })
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').single()
      if (error || !inserted) throw new Error(error?.message ?? '퀘스트 생성 실패')
      const { error: fnErr } = await supabase.functions.invoke('run_quest', { body: { center_id: centerId, quest_id: inserted.id } })
      if (fnErr) throw new Error(fnErr.message)
      const { data: done } = await supabase.from('analysis_quests')
        .select('id, title, quest_type, params, status, result, error, created_at, updated_at').eq('id', inserted.id).single()
      const q = (done ?? inserted) as { status?: string; error?: string | null; result?: PNode['result'] }
      setNodes((ns) => ns.map((n) => n.type === 'output' ? { ...n, result: q.result ?? null } : n))
      onResult((done ?? inserted) as never)
      setRunMsg(q.status === 'error'
        ? { type: 'error', text: q.error ?? '분석 중 오류가 발생했습니다.' }
        : { type: 'success', text: '파이프라인 실행이 완료되었습니다.' })
    } catch (e) {
      setRunMsg({ type: 'error', text: (e as Error).message })
    } finally { setRunning(false) }
  }

  const sel = nodes.find((n) => n.id === selected) ?? null
  const center = (n: PNode) => ({ x: n.x + NW / 2, y: n.y + NH / 2 })

  return (
    <div className="border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] overflow-hidden">
      {/* toolbar */}
      <div className="h-10 px-3 flex items-center gap-2 border-b border-line bg-fill-2">
        <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mr-1">파이프라인 캔버스</span>
        <div className="flex items-center gap-1">
          {(['source', 'filter', 'analysis', 'sim', 'output'] as NType[]).map((t) => {
            const M = NODE_META[t]
            return (
              <button key={t} onClick={() => addNode(t)} title={`${M.label} 추가`}
                className="h-7 px-2 inline-flex items-center gap-1 rounded-[3px] border border-line text-[11px] text-ink-soft hover:bg-fill">
                <Plus size={11} /><M.icon size={12} style={{ color: M.color }} />
              </button>
            )
          })}
        </div>
        <button onClick={() => setConnectFrom(connectFrom === null ? (selected ?? null) : null)}
          className={`h-7 px-2 inline-flex items-center gap-1 rounded-[3px] border text-[11px] ${connectFrom !== null ? 'bg-accent text-white border-accent' : 'border-line text-ink-soft hover:bg-fill'}`}>
          <Link2 size={12} /> {connectFrom !== null ? '연결할 노드 선택' : '연결 모드'}
        </button>
        <div className="flex-1" />
        {runMsg && (
          <span className={`text-[11px] px-2 py-1 rounded-[3px] mr-1 ${runMsg.type === 'success' ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft'}`}>{runMsg.text}</span>
        )}
        <Button variant="secondary" size="sm" onClick={runSim}><FlaskConical size={12} /> 시뮬레이션</Button>
        <Button size="sm" loading={running} onClick={runPipeline}><Play size={12} /> 파이프라인 실행</Button>
      </div>

      <div className="flex">
        {/* canvas */}
        <div ref={canvasRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          className="relative flex-1 h-[340px] overflow-hidden bg-fill-2"
          style={{ backgroundImage: 'radial-gradient(circle, #d4dde4 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
          {/* edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker id="pa" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" fill="#a7b6c2" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to)
              if (!a || !b) return null
              const p1 = center(a), p2 = center(b)
              return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#a7b6c2" strokeWidth={1.5} markerEnd="url(#pa)" />
            })}
          </svg>
          {/* nodes */}
          {nodes.map((n) => {
            const M = NODE_META[n.type]
            const isSel = selected === n.id
            const sub = n.type === 'source' ? `아동 ${totalChildren} · 교사 ${staffCount}`
              : n.type === 'filter' ? (n.scope === 'ALL' ? '전체 센터' : classes.find((c) => c.id === n.scope)?.name ?? '—')
              : n.type === 'analysis' ? (QUEST_TYPES.find((q) => q.v === n.questType)?.t ?? '—')
              : n.type === 'sim' ? (n.sim != null ? `예상 ${n.sim}건` : '미실행')
              : (n.result ? '결과 있음' : '대기')
            return (
              <div key={n.id} onPointerDown={(e) => onPointerDownNode(e, n)} onClick={() => clickNode(n)}
                style={{ left: n.x, top: n.y, width: NW }}
                className={`absolute select-none cursor-move bg-surface border rounded-[3px] shadow-[var(--shadow-card)] ${isSel ? 'border-accent ring-1 ring-accent/40' : connectFrom === n.id ? 'border-accent' : 'border-line'}`}>
                <div className="h-7 px-2 flex items-center gap-1.5 border-b border-line" style={{ background: `${M.color}10` }}>
                  <M.icon size={12} style={{ color: M.color }} />
                  <span className="text-[11px] font-semibold text-ink truncate">{M.label}</span>
                  <Move size={10} className="text-ink-ghost ml-auto" />
                </div>
                <div className="px-2 py-2">
                  <p className="text-[11px] text-ink-soft truncate">{sub}</p>
                  {n.type === 'output' && n.result && <p className="text-[10px] text-ink-faint mt-0.5 line-clamp-2 leading-tight">{n.result.headline}</p>}
                </div>
              </div>
            )
          })}
        </div>

        {/* inspector */}
        <div className="w-[210px] border-l border-line p-3 bg-fill-2 shrink-0">
          {!sel ? (
            <p className="text-[11px] text-ink-ghost">노드를 선택하면 설정을 편집할 수 있습니다.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink">{NODE_META[sel.type].label}</span>
                <button onClick={() => deleteNode(sel.id)} className="text-ink-ghost hover:text-danger"><Trash2 size={13} /></button>
              </div>
              {sel.type === 'filter' && (
                <div>
                  <label className="block text-[10px] text-ink-faint mb-1">분석 범위</label>
                  <select value={sel.scope} onChange={(e) => patchNode(sel.id, { scope: e.target.value })}
                    className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                    <option value="ALL">전체 센터</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
                  </select>
                </div>
              )}
              {sel.type === 'analysis' && (
                <div>
                  <label className="block text-[10px] text-ink-faint mb-1">분석 유형</label>
                  <select value={sel.questType} onChange={(e) => patchNode(sel.id, { questType: e.target.value })}
                    className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                    {QUEST_TYPES.map((q) => <option key={q.v} value={q.v}>{q.t}</option>)}
                  </select>
                </div>
              )}
              {sel.type === 'sim' && (
                <div className="text-[12px] text-ink-soft">
                  {sel.sim != null ? <p>예상 영향 <strong className="text-accent">{sel.sim}</strong>건</p> : <p className="text-ink-ghost">시뮬레이션 미실행</p>}
                </div>
              )}
              {sel.type === 'output' && (
                sel.result ? (
                  <div className="space-y-2">
                    <p className="text-[12px] text-ink font-medium leading-snug">{sel.result.headline}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sel.result.stats?.map((s, i) => (
                        <div key={i} className="px-2 py-1 bg-surface border border-line rounded-[3px]">
                          <p className="text-[9px] text-ink-faint">{s.label}</p>
                          <p className="text-[13px] font-semibold text-ink">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-[11px] text-ink-ghost">실행 후 결과가 표시됩니다.</p>
              )}
              {sel.type === 'source' && <p className="text-[11px] text-ink-soft">아동 {totalChildren} · 교사 {staffCount} · SNA노드 {entityCount}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
