'use client'

import { createClient } from '@/utils/supabase/client'
import { withTimeout } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Database, Filter, FlaskConical, GitBranch, Play, Plus, Trash2, BarChart3, Link2, Move, Tag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type NType = 'source' | 'filter' | 'analysis' | 'label' | 'sim' | 'output'
interface PNode {
  id: string; type: NType; x: number; y: number
  questType?: string       // analysis engine
  filterDim?: string       // filter dimension (class/age/gender/...)
  filterVal?: string       // filter value within the dimension
  labelKey?: string        // data-label node signal
  result?: { headline: string; stats: { label: string; value: string | number }[] } | null
  sim?: number | null
}
interface Edge { from: string; to: string }
interface ClassOpt { id: string; name: string; count: number }
interface Insights {
  summary?: { children: number; isolated: number; communities?: number; avg_betweenness?: number }
  conflict_children?: unknown[]; allergy_children?: unknown[]
  most_influential?: unknown[]; top_brokers?: unknown[]; isolated?: unknown[]
  entities?: Record<string, number>
}

// ── analysis engines ────────────────────────────────────────────────────────
// server engines run on the run_quest edge function (real results over the
// dataset); client engines are computed in-browser from the SNA insights so the
// pipeline stays fully functional without a server round-trip.
const SERVER_TYPES = new Set([
  'isolation_risk', 'tutor_matching', 'conflict_watch', 'attendance_summary', 'allergy_diet',
  'achievement_gap', 'space_preference', 'health_contagion', 'allergy_safety', 'developmental_support', 'hub_collapse',
])
const QUEST_TYPES: { v: string; t: string }[] = [
  { v: 'isolation_risk', t: '고립 위험 탐지' }, { v: 'tutor_matching', t: '또래 튜터링' },
  { v: 'conflict_watch', t: '갈등 모니터링' }, { v: 'attendance_summary', t: '출결 이상' },
  { v: 'allergy_diet', t: '알레르기·식단' }, { v: 'achievement_gap', t: '성취 보충' },
  { v: 'space_preference', t: '공간 선호' },
  { v: 'health_contagion', t: '전염성 확산 (WHO IMCI)' }, { v: 'allergy_safety', t: '알레르겐 안전 (Codex/WHO)' },
  { v: 'developmental_support', t: '발달 지원 (WHO ICF-CY)' }, { v: 'hub_collapse', t: '허브 붕괴 시뮬레이션' },
  // client-computed engines
  { v: 'community_detection', t: '커뮤니티 구조 분석' }, { v: 'influence_map', t: '영향력 매핑' },
  { v: 'broker_path', t: '중재 경로 탐색' }, { v: 'engagement_score', t: '참여도 스코어' },
  { v: 'risk_composite', t: '복합 위험 지수' },
]

// ── range filters ───────────────────────────────────────────────────────────
const FILTER_DIMS: { v: string; t: string }[] = [
  { v: 'class', t: '반' }, { v: 'age', t: '연령대' }, { v: 'gender', t: '성별' },
  { v: 'enrollment', t: '등록 유형' }, { v: 'attendance', t: '출결 상태' }, { v: 'health', t: '건강 상태' },
]
const DIM_VALUES: Record<string, { v: string; t: string }[]> = {
  age: [{ v: '만 0세', t: '만 0세' }, { v: '만 1세', t: '만 1세' }, { v: '만 2세', t: '만 2세' }, { v: '만 3세', t: '만 3세' }, { v: '만 4세', t: '만 4세' }, { v: '만 5세', t: '만 5세' }],
  gender: [{ v: 'male', t: '남아' }, { v: 'female', t: '여아' }],
  enrollment: [{ v: 'general', t: '일반' }, { v: 'beneficiary', t: '수급/지원' }],
  attendance: [{ v: 'good', t: '출석 양호' }, { v: 'absent_freq', t: '결석 잦음' }, { v: 'late_freq', t: '지각 잦음' }],
  health: [{ v: 'normal', t: '정상' }, { v: 'watch', t: '관찰 요망' }, { v: 'allergy', t: '알레르기' }, { v: 'highrisk', t: '고위험' }],
}
// rough population factor applied to estimates when a non-class filter narrows scope
const DIM_FACTOR: Record<string, number> = { good: 0.7, absent_freq: 0.2, late_freq: 0.15, normal: 0.6, watch: 0.2, allergy: 0.12, highrisk: 0.08, male: 0.5, female: 0.5, general: 0.85, beneficiary: 0.15, '만 0세': 0.16, '만 1세': 0.2, '만 2세': 0.2, '만 3세': 0.18, '만 4세': 0.14, '만 5세': 0.12 }

// ── data labels (signals an engine can be wired to) ─────────────────────────
const LABELS: { v: string; t: string }[] = [
  { v: 'sna', t: '관계망' }, { v: 'attendance', t: '출결' }, { v: 'health', t: '건강' },
  { v: 'allergy', t: '알레르기' }, { v: 'achievement', t: '성취' }, { v: 'space', t: '공간 선호' },
  { v: 'development', t: '발달' }, { v: 'conflict', t: '갈등' },
]

const NODE_META: Record<NType, { label: string; icon: typeof Database; color: string }> = {
  source: { label: '데이터 소스', icon: Database, color: '#137cbd' },
  filter: { label: '범위 필터', icon: Filter, color: '#0f9960' },
  analysis: { label: '분석 엔진', icon: GitBranch, color: '#8b5cf6' },
  label: { label: '데이터 레이블', icon: Tag, color: '#d9822b' },
  sim: { label: '시뮬레이션', icon: FlaskConical, color: '#c08a3e' },
  output: { label: '결과 출력', icon: BarChart3, color: '#5c7080' },
}
const NW = 156, NH = 72
const MIN_ZOOM = 0.5, MAX_ZOOM = 1.8
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

let idc = 100
const nid = () => `n${idc++}`

interface Props {
  centerId: string; classes: ClassOpt[]; insights: Insights | null
  staffCount: number; entityCount: number
  onResult: (quest: { id: string; title: string; quest_type: string; params: Record<string, unknown> | null; status: 'pending' | 'running' | 'done' | 'error'; result: never; error: string | null; created_at: string; updated_at: string }) => void
  questType?: string; scope?: string
  onQuestType?: (v: string) => void; onScope?: (v: string) => void
}

export function PipelineCanvas({ centerId, classes, insights, staffCount, entityCount, onResult, questType, scope: scopeProp, onQuestType, onScope }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<PNode[]>([
    { id: 'src', type: 'source', x: 12, y: 96 },
    { id: 'flt', type: 'filter', x: 168, y: 96, filterDim: 'class', filterVal: scopeProp ?? 'ALL' },
    { id: 'lbl', type: 'label', x: 168, y: 12, labelKey: 'sna' },
    { id: 'ana', type: 'analysis', x: 332, y: 64, questType: questType ?? 'isolation_risk' },
    { id: 'out', type: 'output', x: 496, y: 28, result: null },
    { id: 'sim', type: 'sim', x: 496, y: 140, sim: null },
  ])
  const [edges, setEdges] = useState<Edge[]>([
    { from: 'src', to: 'flt' }, { from: 'flt', to: 'ana' }, { from: 'lbl', to: 'ana' },
    { from: 'ana', to: 'out' }, { from: 'ana', to: 'sim' },
  ])
  const [selected, setSelected] = useState<string | null>('ana')

  // two-way sync limited to the SELECTED node only, so multiple filter/analysis
  // nodes keep their own distinct values instead of all collapsing to one.
  useEffect(() => {
    if (questType == null) return
    setNodes((ns) => ns.map((n) => (n.id === selected && n.type === 'analysis' && n.questType !== questType ? { ...n, questType } : n)))
  }, [questType, selected])
  useEffect(() => {
    if (scopeProp == null) return
    setNodes((ns) => ns.map((n) => (n.id === selected && n.type === 'filter' && n.filterDim === 'class' && n.filterVal !== scopeProp ? { ...n, filterVal: scopeProp } : n)))
  }, [scopeProp, selected])

  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const view = useRef({ zoom: 1, pan: { x: 0, y: 0 } })
  view.current = { zoom, pan }
  const drag = useRef<{ mode: 'node'; id: string; dx: number; dy: number } | { mode: 'pan'; sx: number; sy: number; px: number; py: number } | null>(null)

  const totalChildren = insights?.summary?.children ?? 0

  function toWorld(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { zoom: z, pan: p } = view.current
    return { x: (clientX - rect.left - p.x) / z, y: (clientY - rect.top - p.y) / z }
  }

  function onDocMove(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    if (d.mode === 'node') {
      const w = toWorld(e.clientX, e.clientY)
      const x = Math.max(0, Math.min(2000, w.x - d.dx))
      const y = Math.max(0, Math.min(1200, w.y - d.dy))
      setNodes((ns) => ns.map((nn) => (nn.id === d.id ? { ...nn, x, y } : nn)))
    } else {
      setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })
    }
  }
  function onDocUp() {
    drag.current = null
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDocUp)
  }
  function startNodeDrag(e: React.PointerEvent, n: PNode) {
    if (connectFrom !== null) return
    e.stopPropagation()
    const w = toWorld(e.clientX, e.clientY)
    drag.current = { mode: 'node', id: n.id, dx: w.x - n.x, dy: w.y - n.y }
    selectNode(n)
    document.addEventListener('pointermove', onDocMove)
    document.addEventListener('pointerup', onDocUp)
  }
  function startPan(e: React.PointerEvent) {
    if (connectFrom !== null) return
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: view.current.pan.x, py: view.current.pan.y }
    document.addEventListener('pointermove', onDocMove)
    document.addEventListener('pointerup', onDocUp)
  }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const { zoom: z, pan: p } = view.current
      const nz = clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
      const k = nz / z
      setPan({ x: cx - k * (cx - p.x), y: cy - k * (cy - p.y) })
      setZoom(nz)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  // reflect a node's own config up into the shared form when it's selected
  function selectNode(n: PNode) {
    setSelected(n.id)
    if (n.type === 'analysis' && n.questType) onQuestType?.(n.questType)
    if (n.type === 'filter' && n.filterDim === 'class' && n.filterVal) onScope?.(n.filterVal)
  }

  function clickNode(n: PNode) {
    if (connectFrom === null) { selectNode(n); return }
    if (connectFrom !== n.id) {
      setEdges((es) => es.some((x) => x.from === connectFrom && x.to === n.id) ? es : [...es, { from: connectFrom!, to: n.id }])
    }
    setConnectFrom(null)
  }

  function addNode(type: NType) {
    const n: PNode = { id: nid(), type, x: 60 + Math.random() * 120, y: 180 + Math.random() * 60 }
    if (type === 'filter') { n.filterDim = 'class'; n.filterVal = 'ALL' }
    if (type === 'analysis') n.questType = 'isolation_risk'
    if (type === 'label') n.labelKey = 'sna'
    setNodes((ns) => [...ns, n]); setSelected(n.id)
  }
  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id))
    if (selected === id) setSelected(null)
  }
  function patchNode(id: string, patch: Partial<PNode>) { setNodes((ns) => ns.map((n) => n.id === id ? { ...n, ...patch } : n)) }

  // resolve the filter feeding an analysis node (walks incoming edges)
  function filterFor(anaId: string): PNode | null {
    const fromIds = edges.filter((e) => e.to === anaId).map((e) => e.from)
    return nodes.find((n) => n.type === 'filter' && fromIds.includes(n.id)) ?? null
  }
  // data labels wired to an analysis node (either direction)
  function labelsFor(anaId: string): string[] {
    const ids = edges.filter((e) => e.to === anaId || e.from === anaId).map((e) => (e.to === anaId ? e.from : e.to))
    return nodes.filter((n) => n.type === 'label' && ids.includes(n.id)).map((n) => n.labelKey!).filter(Boolean)
  }
  function outputFor(anaId: string): PNode | null {
    const toIds = edges.filter((e) => e.from === anaId).map((e) => e.to)
    return nodes.find((n) => n.type === 'output' && toIds.includes(n.id)) ?? null
  }

  function scopeFactor(flt: PNode | null): number {
    if (!flt) return 1
    if (flt.filterDim === 'class') return flt.filterVal === 'ALL' || !totalChildren ? 1 : Math.max(0.05, (classes.find((c) => c.id === flt.filterVal)?.count ?? 0) / totalChildren)
    return DIM_FACTOR[flt.filterVal ?? ''] ?? 1
  }
  function scopeName(flt: PNode | null): string {
    if (!flt) return '전체 센터'
    if (flt.filterDim === 'class') return flt.filterVal === 'ALL' ? '전체 센터' : classes.find((c) => c.id === flt.filterVal)?.name ?? '선택 반'
    const dim = FILTER_DIMS.find((d) => d.v === flt.filterDim)?.t ?? ''
    const val = DIM_VALUES[flt.filterDim ?? '']?.find((v) => v.v === flt.filterVal)?.t ?? flt.filterVal ?? ''
    return `${dim}: ${val}`
  }

  function estimate(qt: string, flt: PNode | null): number {
    const f = scopeFactor(flt)
    const ins = insights ?? {}
    const pool = Math.round((flt?.filterDim === 'class' && flt.filterVal !== 'ALL' ? (classes.find((c) => c.id === flt.filterVal)?.count ?? 0) : totalChildren) * f)
    switch (qt) {
      case 'isolation_risk': return Math.round((ins.summary?.isolated ?? 0) * f)
      case 'tutor_matching': return Math.round(Math.min(ins.most_influential?.length ?? 0, ins.isolated?.length ?? 0) * f)
      case 'conflict_watch': return Math.round(((ins.conflict_children?.length ?? 0) / 2) * f)
      case 'allergy_diet': case 'allergy_safety': return Math.round((ins.allergy_children?.length ?? 0) * f)
      case 'achievement_gap': return ins.entities?.achievement ?? 0
      case 'space_preference': return ins.entities?.space ?? 0
      case 'community_detection': return ins.summary?.communities ?? 0
      case 'influence_map': return ins.most_influential?.length ?? 0
      case 'broker_path': return ins.top_brokers?.length ?? 0
      default: return Math.round(pool * 0.15)
    }
  }

  // client-side analytical result from SNA insights (for client engines)
  function clientAnalyze(qt: string, flt: PNode | null, labels: string[]) {
    const ins = insights ?? {}
    const sn = scopeName(flt)
    const labelNote = labels.length ? ` · 레이블 ${labels.map((k) => LABELS.find((l) => l.v === k)?.t ?? k).join('·')}` : ''
    const iso = (ins.isolated ?? []) as { name?: string; class_name?: string | null }[]
    const infl = (ins.most_influential ?? []) as { name?: string; eigenvector?: number }[]
    const brok = (ins.top_brokers ?? []) as { name?: string; betweenness?: number }[]
    const stat = (label: string, value: string | number) => ({ label, value })
    const rows = (xs: { primary: string; secondary?: string; tag?: string }[]) => xs.slice(0, 6)
    switch (qt) {
      case 'community_detection':
        return { headline: `${sn} 관계망은 ${ins.summary?.communities ?? 0}개 커뮤니티로 구성됩니다.${labelNote}`,
          stats: [stat('커뮤니티', ins.summary?.communities ?? 0), stat('아동', ins.summary?.children ?? 0), stat('고립', ins.summary?.isolated ?? 0)],
          rows: rows(iso.map((i) => ({ primary: i.name ?? '아동', secondary: i.class_name ?? undefined, tag: '연결 보강' }))) }
      case 'influence_map':
        return { headline: `영향력 상위 ${infl.length}명을 멘토 후보로 도출했습니다.${labelNote}`,
          stats: [stat('멘토 후보', infl.length), stat('평균 매개', (ins.summary?.avg_betweenness ?? 0).toFixed(1))],
          rows: rows(infl.map((m) => ({ primary: m.name ?? '아동', secondary: `영향력 ${(m.eigenvector ?? 0).toFixed(2)}`, tag: '인기' }))) }
      case 'broker_path':
        return { headline: `핵심 매개자 ${brok.length}명이 관계망을 연결합니다.${labelNote}`,
          stats: [stat('핵심 매개자', brok.length)],
          rows: rows(brok.map((b) => ({ primary: b.name ?? '아동', secondary: `매개 ${(b.betweenness ?? 0).toFixed(1)}`, tag: '허브' }))) }
      case 'engagement_score': {
        const e = ins.entities ?? {}
        const score = Math.min(100, Math.round(((e.space ?? 0) + (e.achievement ?? 0) + (e.skill ?? 0)) / Math.max(1, ins.summary?.children ?? 1) * 100))
        return { headline: `${sn} 활동 참여도 종합 스코어는 ${score}점입니다.`,
          stats: [stat('참여 스코어', score), stat('공간 노드', e.space ?? 0), stat('성취 노드', e.achievement ?? 0)], rows: [] }
      }
      case 'risk_composite': {
        const risk = (ins.summary?.isolated ?? 0) * 2 + (ins.conflict_children?.length ?? 0) + (ins.allergy_children?.length ?? 0)
        return { headline: `${sn} 복합 위험 지수 ${risk} — 고립·갈등·알레르기 신호 가중 합산.${labelNote}`,
          stats: [stat('위험 지수', risk), stat('고립', ins.summary?.isolated ?? 0), stat('갈등', ins.conflict_children?.length ?? 0), stat('알레르기', ins.allergy_children?.length ?? 0)],
          rows: rows(iso.map((i) => ({ primary: i.name ?? '아동', tag: '우선 관찰' }))) }
      }
      default:
        return { headline: `${sn} 분석 결과입니다.${labelNote}`, stats: [stat('대상', estimate(qt, flt))], rows: [] }
    }
  }

  function runSim() {
    setNodes((ns) => {
      const next = ns.map((n) => ({ ...n }))
      next.filter((n) => n.type === 'sim').forEach((simNode) => {
        // a sim node shows the estimate of the analysis feeding it, else the first
        const upstream = edges.filter((e) => e.to === simNode.id).map((e) => e.from)
        const ana = next.find((n) => n.type === 'analysis' && upstream.includes(n.id)) ?? next.find((n) => n.type === 'analysis')
        simNode.sim = ana ? estimate(ana.questType ?? 'isolation_risk', filterFor(ana.id)) : 0
      })
      return next
    })
  }

  async function runPipeline() {
    if (running) return
    const analyses = nodes.filter((n) => n.type === 'analysis')
    if (analyses.length === 0) { setRunMsg({ type: 'error', text: '분석 엔진 노드가 필요합니다.' }); return }
    if (!centerId) { setRunMsg({ type: 'error', text: '센터 정보를 찾을 수 없습니다.' }); return }
    setRunning(true); setRunMsg(null)
    runSim()
    let ok = 0, fail = 0
    for (const ana of analyses) {
      const flt = filterFor(ana.id)
      const labels = labelsFor(ana.id)
      const qt = ana.questType ?? 'isolation_risk'
      const sn = scopeName(flt)
      const out = outputFor(ana.id)
      try {
        if (SERVER_TYPES.has(qt)) {
          const params = { class_id: flt?.filterDim === 'class' && flt.filterVal !== 'ALL' ? flt.filterVal : null, scope_name: sn, filter_dim: flt?.filterDim ?? 'class', filter_val: flt?.filterVal ?? 'ALL', keys: labels, sensitivity: 'normal', via: 'pipeline' }
          const title = `[파이프라인] ${QUEST_TYPES.find((q) => q.v === qt)?.t ?? qt} · ${sn}`
          const { data: { user } } = await withTimeout(supabase.auth.getUser(), 15000)
          const { data: inserted, error } = await withTimeout(supabase.from('analysis_quests')
            .insert({ center_id: centerId, title, quest_type: qt, params, status: 'pending', created_by: user?.id ?? null })
            .select('id, title, quest_type, params, status, result, error, created_at, updated_at').single(), 15000)
          if (error || !inserted) throw new Error(error?.message ?? '퀘스트 생성 실패')
          const { error: fnErr } = await withTimeout(supabase.functions.invoke('run_quest', { body: { center_id: centerId, quest_id: inserted.id } }), 45000)
          if (fnErr) throw new Error(fnErr.message)
          const { data: done } = await withTimeout(supabase.from('analysis_quests')
            .select('id, title, quest_type, params, status, result, error, created_at, updated_at').eq('id', inserted.id).single(), 15000)
          const q = (done ?? inserted) as { status?: string; result?: PNode['result'] }
          if (out) patchNode(out.id, { result: q.result ?? null })
          onResult((done ?? inserted) as never)
          q.status === 'error' ? fail++ : ok++
        } else {
          // client engine — computed in-browser, surfaced to the report list
          const r = clientAnalyze(qt, flt, labels)
          const now = new Date().toISOString()
          const synthetic = { id: `client-${nid()}`, title: `[파이프라인] ${QUEST_TYPES.find((q) => q.v === qt)?.t ?? qt} · ${sn}`, quest_type: qt, params: { scope_name: sn, keys: labels, via: 'pipeline-client' }, status: 'done', result: r, error: null, created_at: now, updated_at: now }
          if (out) patchNode(out.id, { result: { headline: r.headline, stats: r.stats } })
          onResult(synthetic as never)
          ok++
        }
      } catch {
        fail++
      }
    }
    setRunning(false)
    setRunMsg(fail === 0
      ? { type: 'success', text: `${ok}개 엔진 실행이 완료되었습니다.` }
      : { type: 'error', text: `${ok}개 성공 · ${fail}개 실패` })
  }

  const sel = nodes.find((n) => n.id === selected) ?? null
  const center = (n: PNode) => ({ x: n.x + NW / 2, y: n.y + NH / 2 })

  function nodeSub(n: PNode): string {
    switch (n.type) {
      case 'source': return `아동 ${totalChildren} · 교사 ${staffCount}`
      case 'filter': return scopeName(n)
      case 'analysis': return QUEST_TYPES.find((q) => q.v === n.questType)?.t ?? '—'
      case 'label': return LABELS.find((l) => l.v === n.labelKey)?.t ?? '—'
      case 'sim': return n.sim != null ? `예상 ${n.sim}건` : '미실행'
      default: return n.result ? '결과 있음' : '대기'
    }
  }

  return (
    <div className="border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] overflow-hidden">
      {/* toolbar */}
      <div className="h-10 px-3 flex items-center gap-2 border-b border-line bg-fill-2">
        <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mr-1">파이프라인 캔버스</span>
        <div className="flex items-center gap-1">
          {(['source', 'filter', 'label', 'analysis', 'sim', 'output'] as NType[]).map((t) => {
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
        <div ref={canvasRef} onPointerDown={startPan}
          className="relative flex-1 h-[620px] overflow-hidden bg-fill-2 touch-none"
          style={{ backgroundImage: 'linear-gradient(#e7ecf1 1px, transparent 1px), linear-gradient(90deg, #e7ecf1 1px, transparent 1px)', backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}>
          <div onPointerDown={(e) => e.stopPropagation()} className="absolute top-2 right-2 z-10 flex items-center bg-surface/90 backdrop-blur border border-line rounded-[3px] overflow-hidden">
            <button onClick={() => setZoom((z) => clampZoom(z / 1.1))} className="w-7 h-7 text-ink-soft hover:bg-fill text-[14px]">−</button>
            <span className="w-10 text-center text-[10px] font-data text-ink-faint tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => clampZoom(z * 1.1))} className="w-7 h-7 text-ink-soft hover:bg-fill text-[14px]">+</button>
            <button onClick={resetView} title="초기화" className="px-2 h-7 border-l border-line text-[10px] text-ink-soft hover:bg-fill">리셋</button>
          </div>
          <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" width={1} height={1}>
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
            {nodes.map((n) => {
              const M = NODE_META[n.type]
              const isSel = selected === n.id
              return (
                <div key={n.id} onPointerDown={(e) => startNodeDrag(e, n)} onClick={() => clickNode(n)}
                  style={{ left: n.x, top: n.y, width: NW }}
                  className={`absolute select-none cursor-move bg-surface border rounded-[3px] shadow-[var(--shadow-card)] ${isSel ? 'border-accent ring-1 ring-accent/40' : connectFrom === n.id ? 'border-accent' : 'border-line'}`}>
                  <div className="h-7 px-2 flex items-center gap-1.5 border-b border-line" style={{ background: `${M.color}10` }}>
                    <M.icon size={12} style={{ color: M.color }} />
                    <span className="text-[11px] font-semibold text-ink truncate">{M.label}</span>
                    <Move size={10} className="text-ink-ghost ml-auto" />
                  </div>
                  <div className="px-2 py-2">
                    <p className="text-[11px] text-ink-soft truncate">{nodeSub(n)}</p>
                    {n.type === 'output' && n.result && <p className="text-[10px] text-ink-faint mt-0.5 line-clamp-2 leading-tight">{n.result.headline}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* inspector */}
        <div className="w-[210px] border-l border-line p-3 bg-fill-2 shrink-0">
          {!sel ? (
            <p className="text-[11px] text-ink-ghost">노드를 선택하면 설정을 편집할 수 있습니다. <span className="text-ink-faint">연결 모드</span>로 분석 엔진을 범위 필터·데이터 레이블과 연결하면, 각 엔진이 연결된 데이터만 분석합니다.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink">{NODE_META[sel.type].label}</span>
                <button onClick={() => deleteNode(sel.id)} className="text-ink-ghost hover:text-danger"><Trash2 size={13} /></button>
              </div>
              {sel.type === 'filter' && (
                <>
                  <div>
                    <label className="block text-[10px] text-ink-faint mb-1">필터 차원</label>
                    <select value={sel.filterDim} onChange={(e) => { const d = e.target.value; patchNode(sel.id, { filterDim: d, filterVal: d === 'class' ? 'ALL' : (DIM_VALUES[d]?.[0]?.v ?? '') }) }}
                      className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                      {FILTER_DIMS.map((d) => <option key={d.v} value={d.v}>{d.t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-faint mb-1">값</label>
                    {sel.filterDim === 'class' ? (
                      <select value={sel.filterVal} onChange={(e) => { patchNode(sel.id, { filterVal: e.target.value }); onScope?.(e.target.value) }}
                        className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                        <option value="ALL">전체 센터</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
                      </select>
                    ) : (
                      <select value={sel.filterVal} onChange={(e) => patchNode(sel.id, { filterVal: e.target.value })}
                        className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                        {(DIM_VALUES[sel.filterDim ?? ''] ?? []).map((v) => <option key={v.v} value={v.v}>{v.t}</option>)}
                      </select>
                    )}
                  </div>
                </>
              )}
              {sel.type === 'analysis' && (
                <div>
                  <label className="block text-[10px] text-ink-faint mb-1">분석 엔진</label>
                  <select value={sel.questType} onChange={(e) => { patchNode(sel.id, { questType: e.target.value }); onQuestType?.(e.target.value) }}
                    className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                    {QUEST_TYPES.map((q) => <option key={q.v} value={q.v}>{q.t}</option>)}
                  </select>
                  <p className="text-[10px] text-ink-ghost mt-1.5">연결된 레이블: {labelsFor(sel.id).map((k) => LABELS.find((l) => l.v === k)?.t).filter(Boolean).join(' · ') || '없음'}</p>
                </div>
              )}
              {sel.type === 'label' && (
                <div>
                  <label className="block text-[10px] text-ink-faint mb-1">데이터 레이블</label>
                  <select value={sel.labelKey} onChange={(e) => patchNode(sel.id, { labelKey: e.target.value })}
                    className="w-full h-8 px-2 bg-surface border border-line rounded-[3px] text-[12px] text-ink">
                    {LABELS.map((l) => <option key={l.v} value={l.v}>{l.t}</option>)}
                  </select>
                  <p className="text-[10px] text-ink-ghost mt-1.5">분석 엔진에 연결하면 해당 신호가 분석에 포함됩니다.</p>
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
