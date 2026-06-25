'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

// ----- data shapes (from get_sna_graph / get_sna_insights) ------------------
type Kind = 'child' | 'staff' | 'guardian' | 'space' | 'skill' | 'food' | 'achievement' | 'ecosystem'
type Group =
  | 'child_active' | 'child_isolated' | 'child_sick' | 'child_highrisk'
  | 'guardian' | 'teacher' | 'director' | 'space' | 'skill' | 'food' | 'achievement' | 'ecosystem'

interface SnaNode {
  id: string
  kind: Kind
  name: string
  group: Group
  class_id: string | null
  class_name: string | null
  connection_count: number
  betweenness: number
  eigenvector: number
  closeness: number
  community_id: number | null
  is_isolated: boolean
  health_status: 'normal' | 'watch' | 'highrisk' | 'confirmed'
  has_allergy: boolean
}
interface SnaEdge {
  id: string
  source_id: string
  target_id: string
  relation_type: string
  label: string | null
  strength: number
  has_conflict: boolean
  is_directed: boolean
}
interface Insights {
  summary?: { children: number; isolated: number; communities: number; avg_betweenness: number }
  isolated?: { child_id: string; name: string; class_name: string | null }[]
  top_brokers?: { child_id: string; name: string; betweenness: number }[]
  most_influential?: { child_id: string; name: string; eigenvector: number }[]
  conflict_children?: { child_id: string; name: string; conflicts: number }[]
  communities?: { community_id: number; size: number; members: string[] }[]
  allergy_children?: { child_id: string; name: string; allergies: string }[]
  health_alerts?: { child_id: string; name: string; note: string; level: string }[]
  cross_class_links?: number
  entities?: Record<string, number>
}
interface Props {
  centerId: string
  nodes: SnaNode[]
  edges: SnaEdge[]
  insights: Insights | null
  classes: { id: string; name: string }[]
}

// ----- visual config (matches the design spec) ------------------------------
const GROUP_STYLE: Record<Group, Record<string, unknown>> = {
  child_active: { shape: 'dot', color: { background: '#eff6ff', border: '#3b82f6' }, font: { color: '#0f172a' } },
  child_isolated: { shape: 'dot', color: { background: '#f8fafc', border: '#94a3b8' }, font: { color: '#475569' } },
  child_sick: { shape: 'dot', color: { background: '#fef2f2', border: '#ef4444' }, font: { color: '#7f1d1d' }, shadow: { enabled: true, color: 'rgba(239,68,68,0.25)', size: 12, x: 0, y: 0 } },
  child_highrisk: { shape: 'dot', color: { background: '#fff7ed', border: '#f97316' }, font: { color: '#9a3412' } },
  guardian: { shape: 'box', color: { background: '#fff1f2', border: '#fb7185' }, font: { color: '#9f1239', size: 11 }, shapeProperties: { borderRadius: 12 } },
  teacher: { shape: 'box', color: { background: '#ffffff', border: '#8b5cf6' }, font: { color: '#6d28d9' }, shapeProperties: { borderRadius: 16 } },
  director: { shape: 'box', color: { background: '#fdf4ff', border: '#c026d3' }, font: { color: '#701a75', size: 13 }, shapeProperties: { borderRadius: 6 } },
  space: { shape: 'box', color: { background: '#0f172a', border: '#020617' }, font: { color: '#ffffff' }, shapeProperties: { borderRadius: 6 } },
  skill: { shape: 'hexagon', color: { background: '#fffbeb', border: '#f59e0b' }, font: { color: '#92400e' } },
  food: { shape: 'box', color: { background: '#ecfdf5', border: '#10b981' }, font: { color: '#047857' }, shapeProperties: { borderRadius: 4 } },
  achievement: { shape: 'box', color: { background: '#fefce8', border: '#eab308' }, font: { color: '#854d0e', size: 13 }, shapeProperties: { borderRadius: 4 } },
  ecosystem: { shape: 'box', color: { background: '#ecfeff', border: '#06b6d4' }, font: { color: '#164e63' }, shapeProperties: { borderRadius: 6 } },
}

const LEGEND: { c: string; label: string; ring?: boolean }[] = [
  { c: '#3b82f6', label: '일반 아동' },
  { c: '#94a3b8', label: '고립 아동' },
  { c: '#ef4444', label: '보건 확진', ring: true },
  { c: '#f97316', label: '감염 고위험' },
  { c: '#fb7185', label: '보호자' },
  { c: '#8b5cf6', label: '교사/스태프' },
  { c: '#c026d3', label: '관리자(원장)' },
  { c: '#0f172a', label: '물리 공간' },
  { c: '#f59e0b', label: '발달 스킬' },
  { c: '#10b981', label: '식재료/알러지' },
  { c: '#eab308', label: '성취도(SOLAR)' },
  { c: '#06b6d4', label: '생태계(VMS)' },
]

const RELATION_LABEL: Record<string, string> = {
  play: '놀이', communication: '의사소통', help_seeking: '도움요청',
  caregiving: '돌봄', proximity: '근접', conflict: '갈등',
}

// edge color / width / dash from semantics + label keywords
function edgeStyle(e: SnaEdge): { color: string; width: number; dashes: boolean | number[] } {
  const l = e.label ?? ''
  const w = (base: number) => Math.min(base + e.strength * 0.6, 6)
  if (l.includes('알러지')) return { color: '#dc2626', width: 4, dashes: [4, 4] }
  if (e.relation_type === 'conflict' || l.includes('갈등') || l.includes('분쟁')) return { color: '#ef4444', width: w(1.5), dashes: [6, 4] }
  if (l.includes('밀접 접촉')) return { color: '#f97316', width: w(1.5), dashes: [2, 2] }
  if (l.includes('기피') || l.includes('거부감')) return { color: '#475569', width: 3, dashes: [5, 5] }
  if (l.includes('단짝')) return { color: '#2563eb', width: 4, dashes: false }
  if (l.includes('친밀') || l.includes('모방') || e.relation_type === 'play') return { color: '#3b82f6', width: w(1.5), dashes: false }
  if (l.includes('위로') || l.includes('도움요청')) return { color: '#8b5cf6', width: 2, dashes: false }
  if (l.includes('마스터') || l.includes('우수') || l.includes('상위') || l.includes('탁월') || l.includes('최우수')) return { color: '#10b981', width: 3, dashes: false }
  if (l.includes('도움 필요') || l.includes('보충') || l.includes('부족') || l.includes('저조') || l.includes('어려')) return { color: '#f59e0b', width: 2, dashes: [4, 4] }
  if (l.includes('편식')) return { color: '#ef4444', width: w(1.5), dashes: [4, 4] }
  if (l.includes('가족')) return { color: '#fda4af', width: 1.5, dashes: [3, 3] }
  if (l.includes('업무 하중') || l.includes('관찰 누락')) return { color: '#9333ea', width: 2, dashes: [4, 4] }
  if (e.relation_type === 'caregiving') return { color: '#e11d48', width: 3, dashes: [4, 4] }
  if (l.includes('선호') || e.relation_type === 'proximity') return { color: l.includes('강한') ? '#64748b' : '#94a3b8', width: l.includes('강한') ? 3 : 2, dashes: false }
  if (e.relation_type === 'communication') return { color: '#06b6d4', width: 2, dashes: false }
  return { color: '#cbd5e1', width: 1.5, dashes: false }
}

function nodeSize(n: SnaNode, maxBetw: number): number {
  if (n.kind !== 'child') return 14
  return 12 + 14 * Math.sqrt((n.betweenness || 0) / maxBetw)
}
function displayLabel(n: SnaNode): string {
  if (n.kind !== 'child') return n.name
  let suffix = ''
  if (n.group === 'child_sick') suffix = '\n(확진)'
  else if (n.group === 'child_highrisk') suffix = '\n(고위험)'
  else if (n.group === 'child_isolated') suffix = '\n(고립)'
  else if (n.has_allergy) suffix = '\n(알러지)'
  return n.name + suffix
}

interface Report { title: string; body: React.ReactNode }

function MetricBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-ink-soft">{label}</span>
        <span className="text-[11px] font-semibold text-ink tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-fill rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

// decision-support actions derived from a child node's status / relations
function childActions(group: Group, hasAllergy: boolean, hasConflict: boolean, betwHigh: boolean): string[] {
  const a: string[] = []
  if (group === 'child_sick') a.push('즉시 격리 및 선호 공간 소독', '보호자 알림톡 발송 · 밀접 접촉 아동 체온 추적')
  if (group === 'child_highrisk') a.push('체온 정기 모니터링 · 활동 동선 분리')
  if (group === 'child_isolated') a.push('관심사 기반 또래 짝 활동 배정', '담당 교사 관찰 빈도 상향')
  if (hasAllergy) a.push('식단 분리 철저 · 응급 키트(에피펜) 점검')
  if (hasConflict) a.push('갈등 상대와 좌석·활동 분리 후 중재 프로그램')
  if (betwHigh) a.push('핵심 매개자로서 또래 튜터·중재자 역할 부여')
  if (a.length === 0) a.push('현재 특이 위험 신호 없음 · 정기 관찰 유지')
  return a
}

export function SnaClient({ centerId, nodes, edges, insights, classes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const netRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dsRef = useRef<{ nodes: any; edges: any } | null>(null)

  const [scope, setScope] = useState<string>('ALL')
  const [recomputing, setRecomputing] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchError, setSearchError] = useState(false)
  const [report, setReport] = useState<Report | null>(null)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const maxBetw = useMemo(() => Math.max(1, ...nodes.map((n) => n.betweenness || 0)), [nodes])
  const maxEig = useMemo(() => Math.max(0.001, ...nodes.map((n) => n.eigenvector || 0)), [nodes])
  const maxConn = useMemo(() => Math.max(1, ...nodes.map((n) => n.connection_count || 0)), [nodes])

  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>()
    nodes.forEach((n) => m.set(n.id, new Set()))
    edges.forEach((e) => { m.get(e.source_id)?.add(e.target_id); m.get(e.target_id)?.add(e.source_id) })
    return m
  }, [nodes, edges])

  // ---- build the network once -------------------------------------------
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const vis = await import('vis-network/standalone')
      if (disposed || !containerRef.current) return

      const visNodes = new vis.DataSet(
        nodes.map((n) => ({
          id: n.id, label: displayLabel(n), group: n.group,
          size: nodeSize(n, maxBetw),
          font: { multi: true, face: 'Pretendard, Noto Sans KR, sans-serif', size: n.kind === 'child' ? 12 : 11 },
        })),
      )
      const visEdges = new vis.DataSet(
        edges.map((e) => {
          const s = edgeStyle(e)
          return {
            id: e.id, from: e.source_id, to: e.target_id, label: e.label ?? '',
            color: { color: s.color, opacity: 0.85 }, width: s.width, dashes: s.dashes,
            arrows: e.is_directed ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
            font: { size: 10, color: '#9aa4b2', strokeWidth: 3, strokeColor: '#0A0C10', align: 'middle' },
            smooth: { enabled: true, type: 'continuous', roundness: 0.4 },
          }
        }),
      )
      dsRef.current = { nodes: visNodes, edges: visEdges }

      const network = new vis.Network(containerRef.current, { nodes: visNodes, edges: visEdges }, {
        nodes: { borderWidth: 1.5, shadow: { enabled: true, color: 'rgba(14,23,38,0.06)', size: 6, x: 0, y: 2 } },
        groups: GROUP_STYLE,
        edges: { smooth: { enabled: true, type: 'continuous', roundness: 0.4 } },
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -120, centralGravity: 0.012, springLength: 150, springConstant: 0.05, avoidOverlap: 0.6 },
          stabilization: { iterations: 220 },
        },
        interaction: { hover: true, tooltipDelay: 200, navigationButtons: false, keyboard: false },
      })
      netRef.current = network

      network.on('click', (params: { nodes: string[] }) => {
        if (params.nodes.length > 0) focusNode(params.nodes[0])
        else resetView()
      })

      cleanup = () => network.destroy()
    })()

    return () => { disposed = true; cleanup() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // ---- focus / fade engine ----------------------------------------------
  function applyFocus(focusNodes: Set<string> | null, focusEdges: Set<string> | null) {
    const ds = dsRef.current
    if (!ds) return
    ds.nodes.update(nodes.map((n) => ({ id: n.id, opacity: !focusNodes || focusNodes.has(n.id) ? 1 : 0.12 })))
    ds.edges.update(edges.map((e) => {
      const s = edgeStyle(e)
      const on = !focusEdges
        ? true
        : focusEdges.has(e.id) || (!!focusNodes && focusNodes.has(e.source_id) && focusNodes.has(e.target_id))
      return { id: e.id, color: { color: s.color, opacity: on ? 0.9 : 0.04 }, font: { color: on ? '#9aa4b2' : 'rgba(154,164,178,0.05)' } }
    }))
    if (netRef.current && focusNodes && focusNodes.size > 0) {
      netRef.current.fit({ nodes: [...focusNodes], animation: { duration: 700, easingFunction: 'easeInOutCubic' } })
    } else if (netRef.current) {
      netRef.current.fit({ animation: { duration: 700, easingFunction: 'easeInOutCubic' } })
    }
  }

  function neighborhood(ids: string[]): Set<string> {
    const set = new Set(ids)
    ids.forEach((id) => adj.get(id)?.forEach((x) => set.add(x)))
    return set
  }

  function resetView() {
    setScope('ALL'); applyVisibility('ALL'); applyFocus(null, null); setReport(overviewReport())
  }

  // class scope: hide children outside the class (+ their guardians)
  function applyVisibility(scopeVal: string) {
    const ds = dsRef.current
    if (!ds) return
    const visibleChild = new Set(nodes.filter((n) => n.kind === 'child' && (scopeVal === 'ALL' || n.class_id === scopeVal)).map((n) => n.id))
    ds.nodes.update(nodes.map((n) => {
      let hidden = false
      if (scopeVal !== 'ALL' && n.kind === 'child') hidden = !visibleChild.has(n.id)
      if (scopeVal !== 'ALL' && n.kind === 'guardian') {
        // guardian connected only to hidden children → hide
        const nbrs = [...(adj.get(n.id) ?? [])]
        hidden = nbrs.length > 0 && nbrs.every((c) => !visibleChild.has(c))
      }
      return { id: n.id, hidden }
    }))
  }

  function handleScope(s: string) { setScope(s); applyVisibility(s); applyFocus(null, null); setReport(scopeReport(s)) }

  // ---- reports -----------------------------------------------------------
  function overviewReport(): Report {
    const s = insights?.summary
    return {
      title: 'Athenae AI 리포트',
      body: (
        <div className="space-y-2.5">
          <p className="text-ink">아동 <strong>{s?.children ?? 0}명</strong> · 고립 <strong>{s?.isolated ?? 0}명</strong> · 커뮤니티 <strong>{s?.communities ?? 0}개</strong>로 구성된 다차원 관계망입니다.</p>
          <p className="text-ink-soft">고립 아동들이 공통적으로 선호하는 공간을 매개로 한 프로그램 편성을 권장합니다. 의존성 엣지가 특정 교사에게 편중되어 있어 업무 분산이 필요합니다.</p>
          <p className="text-ink-faint text-[12px]">맵의 노드를 클릭하면 해당 관계망만 선명하게 남고 나머지는 흐려집니다. 빈 곳을 클릭하면 전체로 돌아옵니다.</p>
        </div>
      ),
    }
  }
  function scopeReport(s: string): Report {
    const name = s === 'ALL' ? '전체 센터' : classes.find((c) => c.id === s)?.name ?? '선택 반'
    return { title: 'Athenae AI 리포트', body: <p className="text-ink-soft">{name} 뷰로 전환했습니다. 선택 범위의 아동, 담당 교사, 배정 보호자, 공용 환경 데이터가 렌더링됩니다.</p> }
  }

  function list(title: string, items: React.ReactNode[], tone: string) {
    if (items.length === 0) return null
    return (
      <div className="mb-3.5">
        <p className={`text-[12px] font-semibold mb-1.5 ${tone}`}>{title}</p>
        <ul className="pl-3 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="relative text-[12px] leading-relaxed text-ink-soft before:content-[''] before:absolute before:-left-3 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-line-strong">{it}</li>
          ))}
        </ul>
      </div>
    )
  }

  function focusNode(id: string) {
    const n = nodeById.get(id)
    if (!n) return
    const set = new Set<string>([id]); adj.get(id)?.forEach((x) => set.add(x))
    applyFocus(set, null)
    const conn = edges.filter((e) => e.source_id === id || e.target_id === id)
    const other = (e: SnaEdge) => nodeById.get(e.source_id === id ? e.target_id : e.source_id)

    if (n.kind === 'child') {
      const friends: React.ReactNode[] = [], spaces: React.ReactNode[] = [], achieve: React.ReactNode[] = [], issues: React.ReactNode[] = [], guardians: React.ReactNode[] = []
      conn.forEach((e) => {
        const t = other(e); if (!t) return
        const lbl = e.label ?? RELATION_LABEL[e.relation_type] ?? ''
        if (t.kind === 'child') (lbl.includes('갈등') || lbl.includes('분쟁') ? issues : friends).push(`${t.name} · ${lbl}`)
        else if (t.kind === 'space') (lbl.includes('기피') ? issues : spaces).push(`${t.name} · ${lbl}`)
        else if (t.kind === 'food') (lbl.includes('알러지') || lbl.includes('편식') ? issues : achieve).push(`${t.name} · ${lbl}`)
        else if (t.kind === 'skill' || t.kind === 'achievement' || t.kind === 'ecosystem')
          (lbl.includes('부족') || lbl.includes('저조') || lbl.includes('거부') || lbl.includes('보충') || lbl.includes('어려') ? issues : achieve).push(`${t.name} · ${lbl}`)
        else if (t.kind === 'guardian') guardians.push(t.name)
        else if (t.kind === 'staff') friends.push(`${t.name} · ${lbl}`)
      })
      const cls = n.class_name ?? '미배정'
      const statusText = n.group === 'child_sick' ? '보건 확진' : n.group === 'child_highrisk' ? '감염 고위험' : n.group === 'child_isolated' ? '고립/관찰요망' : '일반/활발'
      const statusTone = n.group === 'child_sick' ? 'text-danger bg-danger-soft border-[color:var(--color-danger-soft)]' : n.group === 'child_highrisk' ? 'text-warn bg-warn-soft border-[color:var(--color-warn-soft)]' : n.group === 'child_isolated' ? 'text-ink-soft bg-fill border-line' : 'text-success bg-success-soft border-[color:var(--color-success-soft)]'
      const actions = childActions(n.group, n.has_allergy, edges.some((e) => e.has_conflict && (e.source_id === id || e.target_id === id)), n.betweenness > maxBetw * 0.5)
      setReport({
        title: n.name,
        body: (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] border ${statusTone}`}>{statusText}</span>
              <span className="text-[11px] text-ink-faint">{cls}{n.has_allergy ? ' · 알레르기 주의' : ''}{n.community_id != null ? ` · 그룹 ${n.community_id}` : ''}</span>
            </div>

            <div className="space-y-2.5 border border-line rounded-[3px] p-3 bg-fill-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">중심성 지표</p>
              <MetricBar label="연결 (Degree)" value={String(n.connection_count)} pct={(n.connection_count / maxConn) * 100} color="#58A6FF" />
              <MetricBar label="매개 (Betweenness)" value={n.betweenness.toFixed(1)} pct={(n.betweenness / maxBetw) * 100} color="#bc8cff" />
              <MetricBar label="영향력 (Eigenvector)" value={n.eigenvector.toFixed(2)} pct={(n.eigenvector / maxEig) * 100} color="#3FB950" />
              <MetricBar label="근접 (Closeness)" value={n.closeness.toFixed(2)} pct={n.closeness * 100} color="#D29922" />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">권장 조치</p>
              {actions.map((act, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-ink-soft">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />{act}
                </div>
              ))}
            </div>

            <div>
              {list('보호자', guardians, 'text-[#fb7185]')}
              {list('교우·돌봄 관계', friends, 'text-accent')}
              {list('주 활동공간', spaces, 'text-ink-soft')}
              {list('성취 및 긍정 요소', achieve, 'text-success')}
              {list('위험 요소 및 특이사항', issues, 'text-danger')}
            </div>

            <div className="flex flex-wrap gap-2 pt-1 border-t border-line">
              <a href={`/children/${n.id}`} className="text-[11px] text-accent hover:text-accent-hover font-medium">아동 프로필 →</a>
              <a href="/attendance" className="text-[11px] text-ink-soft hover:text-ink">출결 기록</a>
              <a href="/quests" className="text-[11px] text-ink-soft hover:text-ink">퀘스트 분석</a>
            </div>
          </div>
        ),
      })
    } else {
      const conns = conn.map((e) => { const t = other(e); return t ? `${t.name} · ${e.label ?? RELATION_LABEL[e.relation_type] ?? ''}` : null }).filter(Boolean) as string[]
      const kindLabel: Record<string, string> = { staff: '교직원', guardian: '보호자', space: '물리 공간', skill: '발달 스킬', food: '식재료/알러지', achievement: '성취 영역', ecosystem: '생태계 콘텐츠' }
      setReport({ title: n.name, body: <div>{<p className="text-[12px] text-ink-faint mb-3">{kindLabel[n.kind] ?? '노드'} · 연결 {conn.length}</p>}{list('연관 항목 현황', conns, 'text-ink-soft')}</div> })
    }
  }

  function search() {
    const q = searchValue.trim().toLowerCase()
    if (!q) return
    const match = nodes.find((n) => n.name.toLowerCase().includes(q))
    if (!match) { setSearchError(true); return }
    setSearchError(false)
    netRef.current?.selectNodes?.([match.id])
    focusNode(match.id)
  }

  // ---- scenarios (data-driven over the real graph) ----------------------
  function runScenario(type: string) {
    if (scope !== 'ALL') { setScope('ALL'); applyVisibility('ALL') }
    const childIds = (kind: (n: SnaNode) => boolean) => nodes.filter(kind).map((n) => n.id)

    if (type === 'achievement') {
      const ach = childIds((n) => n.kind === 'achievement')
      const involved = edges.filter((e) => ach.includes(e.source_id) || ach.includes(e.target_id))
      const fn = new Set<string>(ach); involved.forEach((e) => { fn.add(e.source_id); fn.add(e.target_id) })
      applyFocus(fn, new Set(involved.map((e) => e.id)))
      setReport({
        title: '학습 성취 & 교우 관계',
        body: (
          <div>
            {list('영향력 상위 (멘토 후보)', (insights?.most_influential ?? []).slice(0, 4).map((b) => `${b.name} · 영향력 ${b.eigenvector.toFixed(2)}`), 'text-indigo-600')}
            {list('핵심 매개자 (또래 허브)', (insights?.top_brokers ?? []).slice(0, 4).map((b) => `${b.name} · 매개 ${b.betweenness.toFixed(1)}`), 'text-emerald-600')}
            <p className="text-[12px] text-ink-soft mt-1">성취 영역과 교우 관계를 겹쳐, 강점 아동을 부족 영역 아동의 또래 멘토로 매칭할 수 있습니다.</p>
          </div>
        ),
      })
    } else if (type === 'preference') {
      const inv = edges.filter((e) => (e.label ?? '').includes('선호') || (e.label ?? '').includes('기피'))
      const fn = new Set<string>(); inv.forEach((e) => { fn.add(e.source_id); fn.add(e.target_id) })
      applyFocus(fn, new Set(inv.map((e) => e.id)))
      setReport({
        title: '선호 vs 기피 성향 분석',
        body: (
          <div>
            {list('강한 기피 신호', edges.filter((e) => (e.label ?? '').includes('기피')).map((e) => `${nodeById.get(e.source_id)?.name} → ${nodeById.get(e.target_id)?.name} · ${e.label}`), 'text-red-600')}
            <p className="text-[12px] text-ink-soft mt-1">소음·혼잡 공간을 기피하는 아동에게는 정적인 공간을 유도하고, 거부 활동에는 대체 프로그램을 제공하세요.</p>
          </div>
        ),
      })
    } else if (type === 'health') {
      const sick = nodes.filter((n) => n.group === 'child_sick' || n.group === 'child_highrisk').map((n) => n.id)
      const inv = edges.filter((e) => (e.label ?? '').includes('밀접 접촉') || sick.includes(e.source_id) || sick.includes(e.target_id))
      const fn = new Set<string>(sick); inv.forEach((e) => { fn.add(e.source_id); fn.add(e.target_id) })
      applyFocus(fn, new Set(inv.map((e) => e.id)))
      setReport({
        title: '보건 역학 전파 분석',
        body: (
          <div>
            {list('보건 경보', (insights?.health_alerts ?? []).map((h) => `${h.name} · ${h.level === 'confirmed' ? '확진' : h.level === 'highrisk' ? '고위험' : '관찰'}`), 'text-red-600')}
            <p className="text-[12px] text-ink-soft mt-1">확진·고위험 아동의 밀접 접촉 경로와 공용 공간을 추적했습니다. 선호 구역 긴급 소독 및 보호자 예방 알림을 권장합니다.</p>
          </div>
        ),
      })
    } else if (type === 'diet') {
      const foods = nodes.filter((n) => n.kind === 'food').map((n) => n.id)
      const inv = edges.filter((e) => foods.includes(e.source_id) || foods.includes(e.target_id))
      const fn = new Set<string>(foods); inv.forEach((e) => { fn.add(e.source_id); fn.add(e.target_id) })
      applyFocus(fn, new Set(inv.map((e) => e.id)))
      setReport({
        title: '식습관 & 알러지 관리',
        body: (
          <div>
            {list('알레르기 관리 대상', (insights?.allergy_children ?? []).map((a) => `${a.name} · ${a.allergies}`), 'text-red-600')}
            {list('편식 신호', edges.filter((e) => (e.label ?? '').includes('편식')).map((e) => `${nodeById.get(e.source_id)?.name ?? ''}${nodeById.get(e.target_id)?.name ?? ''} · 거부`), 'text-amber-600')}
            <p className="text-[12px] text-ink-soft mt-1">알레르기 식재료는 식단에서 완전 배제하고, 편식 아동 옆에 해당 식재료를 선호하는 또래를 배치해 긍정적 모방을 유도하세요.</p>
          </div>
        ),
      })
    } else if (type === 'tutor') {
      const mentors = (insights?.most_influential ?? []).map((m) => m.child_id)
      const learners = (insights?.isolated ?? []).map((m) => m.child_id)
      const fn = neighborhood([...mentors, ...learners])
      applyFocus(fn, null)
      setReport({
        title: '또래 튜터링 매칭',
        body: (
          <div>
            {list('멘토 후보 (영향력)', (insights?.most_influential ?? []).slice(0, 4).map((m) => `${m.name} · ${m.eigenvector.toFixed(2)}`), 'text-amber-600')}
            {list('우선 지원 (고립)', (insights?.isolated ?? []).map((m) => `${m.name}${m.class_name ? ` · ${m.class_name}` : ''}`), 'text-ink-soft')}
            <p className="text-[12px] text-ink-soft mt-1">고립·저참여 아동에게 영향력이 높은 또래를 멘토로 배정하면 네트워크 응집도가 높아집니다. 정밀 매칭은 퀘스트 분석에서 실행하세요.</p>
          </div>
        ),
      })
    } else if (type === 'ecosystem') {
      const eco = nodes.filter((n) => n.kind === 'ecosystem').map((n) => n.id)
      const inv = edges.filter((e) => eco.includes(e.source_id) || eco.includes(e.target_id))
      const fn = new Set<string>(eco); inv.forEach((e) => { fn.add(e.source_id); fn.add(e.target_id) })
      applyFocus(fn, new Set(inv.map((e) => e.id)))
      setReport({
        title: '생태계 시너지 발견',
        body: (
          <div>
            {list('VMS 콘텐츠 참여', inv.map((e) => `${(nodeById.get(e.source_id)?.kind === 'child' ? nodeById.get(e.source_id) : nodeById.get(e.target_id))?.name} · ${e.label}`), 'text-cyan-600')}
            <p className="text-[12px] text-ink-soft mt-1">생태계(VMS) 콘텐츠 고참여 아동들의 협업 구조를 강화하면 공간지각·창의 영역 성취가 함께 상승합니다.</p>
          </div>
        ),
      })
    }
  }

  async function handleRecompute() {
    if (!centerId) return
    setRecomputing(true)
    try {
      const { error } = await supabase.functions.invoke('recompute_sna_metrics', { body: { center_id: centerId, rebuild: false } })
      if (error) throw error
      setReport({ title: '재계산 완료', body: <p className="text-ink-soft">관계망과 중심성 지표를 다시 계산했습니다. 잠시 후 갱신됩니다.</p> })
      router.refresh()
    } catch (e) {
      setReport({ title: '재계산 실패', body: <p className="text-danger">{(e as Error).message}</p> })
    } finally {
      setRecomputing(false)
    }
  }

  useEffect(() => { setReport(overviewReport()) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [insights])

  const SCENARIOS: { key: string; label: string; bar: string }[] = [
    { key: 'achievement', label: '학습 성취 & 교우 관계', bar: 'border-l-yellow-400' },
    { key: 'preference', label: '선호 vs 기피 성향 분석', bar: 'border-l-purple-400' },
    { key: 'health', label: '보건 역학 전파 분석', bar: 'border-l-red-400' },
    { key: 'diet', label: '식습관 & 알러지 관리', bar: 'border-l-emerald-400' },
    { key: 'tutor', label: '또래 튜터링 매칭', bar: 'border-l-amber-400' },
    { key: 'ecosystem', label: '생태계 시너지 발견', bar: 'border-l-cyan-400' },
  ]

  return (
    <div className="relative flex-1 h-[calc(100vh-3rem)] overflow-hidden bg-canvas">
      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-faint">
          <p className="text-sm">표시할 관계망 데이터가 없습니다</p>
          <p className="text-xs text-ink-ghost">평가·관계 입력 후 재계산을 실행하세요</p>
          <button onClick={handleRecompute} disabled={recomputing} className="mt-2 h-8 px-4 text-[12px] rounded-[3px] bg-accent text-[#0A0C10] hover:bg-accent-hover disabled:opacity-50">
            {recomputing ? '재계산 중…' : 'SNA 재계산'}
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Control panel */}
      <div className="absolute top-6 left-6 z-10 w-[330px] max-h-[calc(100%-3rem)] overflow-y-auto rounded-[3px] border border-line bg-surface shadow-[var(--shadow-pop)] p-4">
        <h1 className="text-[15px] font-semibold text-ink tracking-[-0.01em]">SNA 관계망 분석</h1>
        <p className="text-[11px] text-ink-faint mt-0.5 mb-4 pb-4 border-b border-line">LUMIX Pro 다차원 노드 및 복합 엣지</p>

        {/* search */}
        <div className="mb-4 pb-4 border-b border-line">
          <div className="flex gap-1.5">
            <input value={searchValue} onChange={(e) => { setSearchValue(e.target.value); setSearchError(false) }} onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="아동, 교사, 장소 이름 검색"
              className="flex-1 h-9 px-3 bg-fill-2 border border-line rounded-[3px] text-[13px] text-ink placeholder-ink-ghost focus:outline-none focus:border-accent" />
            <button onClick={search} className="h-9 px-3 rounded-[3px] bg-ink text-white text-[12px] hover:opacity-90">검색</button>
          </div>
          {searchError && <p className="text-[11px] text-danger mt-1.5">검색 결과가 존재하지 않습니다.</p>}
        </div>

        {/* scope */}
        <div className="mb-4 pb-4 border-b border-line">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2">조회 범위</p>
          <div className="flex flex-wrap gap-1.5 p-1 bg-fill rounded-[3px]">
            {[{ id: 'ALL', name: '전체 센터' }, ...classes].map((c) => (
              <button key={c.id} onClick={() => handleScope(c.id)}
                className={`flex-1 min-w-[72px] py-1.5 text-[12px] rounded-[3px] transition-all ${scope === c.id ? 'bg-surface text-ink font-semibold shadow-sm' : 'text-ink-faint hover:text-ink'}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* legend */}
        <div className="mb-4 pb-4 border-b border-line">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2.5">노드</p>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11.5px] text-ink-soft">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.c, boxShadow: l.ring ? `0 0 0 3px ${l.c}33` : undefined }} />{l.label}
              </li>
            ))}
          </ul>
        </div>

        {/* scenarios */}
        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2.5">AI Insights</p>
        <div className="space-y-1.5">
          {SCENARIOS.map((s) => (
            <button key={s.key} onClick={() => runScenario(s.key)}
              className={`w-full text-left px-3 py-2.5 text-[13px] font-medium text-ink-soft bg-surface border border-line border-l-[3px] ${s.bar} rounded-[3px] hover:bg-fill hover:text-ink transition-colors`}>
              {s.label}
            </button>
          ))}
          <button onClick={resetView} className="w-full mt-2 py-2.5 px-3 rounded-[3px] bg-ink text-white text-[13px] font-medium hover:opacity-90 transition-opacity">
            전체 화면 새로고침
          </button>
          <button onClick={handleRecompute} disabled={recomputing}
            className="w-full py-2.5 px-3 rounded-[3px] bg-accent text-[#0A0C10] text-[13px] font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors">
            {recomputing ? '중심성 재계산 중…' : '중심성 지표 재계산'}
          </button>
        </div>
      </div>

      {/* Insight drawer */}
      {report && (
        <div className="absolute top-6 right-6 bottom-6 z-10 w-[330px] max-w-[calc(100%-3rem)] flex flex-col rounded-[3px] border border-line bg-surface shadow-[var(--shadow-pop)] overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">{report.title}</span>
            <button onClick={() => setReport(null)} className="text-ink-faint hover:text-ink hover:bg-fill rounded-[3px] w-7 h-7 flex items-center justify-center transition-colors">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-[13px] text-ink-soft leading-relaxed">{report.body}</div>
        </div>
      )}
    </div>
  )
}
