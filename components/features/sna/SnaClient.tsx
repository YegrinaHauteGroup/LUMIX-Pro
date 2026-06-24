'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import * as d3 from 'd3'

type Kind = 'child' | 'staff' | 'guardian'

interface SnaNode {
  id: string
  kind: Kind
  name: string
  class_id: string | null
  class_name: string | null
  connection_count: number
  betweenness: number
  eigenvector: number
  closeness: number
  community_id: number | null
  is_isolated: boolean
}
interface SnaEdge {
  source_id: string
  target_id: string
  relation_type: string
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
  cross_class_links?: number
}
interface Props {
  centerId: string
  nodes: SnaNode[]
  edges: SnaEdge[]
  insights: Insights | null
  classes: { id: string; name: string }[]
}

interface DNode extends d3.SimulationNodeDatum { id: string; d: SnaNode }
interface DLink extends d3.SimulationLinkDatum<DNode> { source: string | DNode; target: string | DNode; e: SnaEdge }

const PALETTE = ['#5a63f2', '#22c55e', '#f59e0b', '#e5484d', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#a3e635']
const KIND_COLOR: Record<Kind, string> = { child: '#5a63f2', staff: '#8b5cf6', guardian: '#06b6d4' }
const RELATION_COLOR: Record<string, string> = {
  play: '#3b82f6', communication: '#3b82f6', help_seeking: '#8b5cf6',
  caregiving: '#10b981', proximity: '#94a3b8', conflict: '#e5484d',
}
const RELATION_LABEL: Record<string, string> = {
  play: '놀이', communication: '의사소통', help_seeking: '도움요청',
  caregiving: '돌봄', proximity: '근접', conflict: '갈등',
}

type ColorMode = 'class' | 'community' | 'kind'

export function SnaClient({ centerId, nodes, edges, insights, classes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [colorMode, setColorMode] = useState<ColorMode>('class')
  const [recomputing, setRecomputing] = useState(false)
  const [insightOpen, setInsightOpen] = useState(true)
  const [insightHtml, setInsightHtml] = useState<{ title: string; body: React.ReactNode }>({
    title: '관계망 개요',
    body: null,
  })

  const classColor = useMemo(() => {
    const m: Record<string, string> = {}
    classes.forEach((c, i) => { m[c.id] = PALETTE[i % PALETTE.length] })
    return m
  }, [classes])

  const nodeColor = (n: SnaNode): string => {
    if (colorMode === 'kind') return KIND_COLOR[n.kind]
    if (colorMode === 'community') return n.community_id == null ? '#94a3b8' : PALETTE[n.community_id % PALETTE.length]
    if (n.kind !== 'child') return KIND_COLOR[n.kind]
    return n.class_id ? classColor[n.class_id] ?? '#5a63f2' : '#94a3b8'
  }

  // adjacency for focus
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>()
    nodes.forEach((n) => m.set(n.id, new Set()))
    edges.forEach((e) => {
      m.get(e.source_id)?.add(e.target_id)
      m.get(e.target_id)?.add(e.source_id)
    })
    return m
  }, [nodes, edges])

  // refs to selections for focus updates without rebuild
  const sel = useRef<{
    node?: d3.Selection<SVGGElement, DNode, SVGGElement, unknown>
    link?: d3.Selection<SVGLineElement, DLink, SVGGElement, unknown>
    fit?: (ids: string[] | null) => void
  }>({})

  function applyFocus(focus: Set<string> | null) {
    const { node, link } = sel.current
    if (!node || !link) return
    node.transition().duration(450)
      .style('opacity', (d) => (!focus || focus.has(d.id) ? 1 : 0.07))
    link.transition().duration(450)
      .style('opacity', (d) => {
        if (!focus) return 0.75
        const s = typeof d.source === 'string' ? d.source : d.source.id
        const t = typeof d.target === 'string' ? d.target : d.target.id
        return focus.has(s) && focus.has(t) ? 0.95 : 0.04
      })
    sel.current.fit?.(focus ? [...focus] : null)
  }

  // ---- scenarios -------------------------------------------------------
  function neighborhood(ids: string[]): Set<string> {
    const set = new Set(ids)
    ids.forEach((id) => adj.get(id)?.forEach((n) => set.add(n)))
    return set
  }

  function runIsolated() {
    const iso = nodes.filter((n) => n.kind === 'child' && n.is_isolated).map((n) => n.id)
    applyFocus(new Set(iso.length ? iso : ['__none__']))
    setInsightOpen(true)
    setInsightHtml({
      title: '고립 아동 탐지',
      body: iso.length === 0
        ? <p>고립된 아동이 없습니다. 모든 아동이 최소 1개의 관계를 맺고 있습니다.</p>
        : <>
            <p>관계망에서 연결이 없는 <strong>{iso.length}명</strong>의 고립 아동을 분리했습니다. 또래 활동·짝 배정으로 연결을 유도하세요.</p>
            <ul className="list-disc list-inside mt-2 space-y-0.5 text-ink-soft">
              {(insights?.isolated ?? []).map((c) => <li key={c.child_id}>{c.name}{c.class_name ? ` · ${c.class_name}` : ''}</li>)}
            </ul>
          </>,
    })
  }
  function runBrokers() {
    const brokers = (insights?.top_brokers ?? []).map((b) => b.child_id)
    applyFocus(neighborhood(brokers))
    setInsightOpen(true)
    setInsightHtml({
      title: '핵심 매개자 · 또래 튜터링',
      body: <>
        <p>최단경로를 가장 많이 매개하는 <strong>핵심 연결자</strong>와 1차 관계망만 강조했습니다. 이들을 또래 튜터·중재자로 활용하면 전체 네트워크 응집이 높아집니다.</p>
        <ul className="list-disc list-inside mt-2 space-y-0.5 text-ink-soft">
          {(insights?.top_brokers ?? []).map((b) => <li key={b.child_id}>{b.name} · 매개 {b.betweenness.toFixed(1)}</li>)}
        </ul>
      </>,
    })
  }
  function runConflict() {
    const ids = new Set<string>()
    edges.filter((e) => e.has_conflict).forEach((e) => { ids.add(e.source_id); ids.add(e.target_id) })
    applyFocus(ids.size ? ids : new Set(['__none__']))
    setInsightOpen(true)
    setInsightHtml({
      title: '갈등 관계 분석',
      body: ids.size === 0
        ? <p>기록된 갈등 관계가 없습니다.</p>
        : <>
            <p>갈등(부정) 관계로 연결된 아동들을 강조했습니다. 좌석·활동 배치 시 분리를 고려하세요.</p>
            <ul className="list-disc list-inside mt-2 space-y-0.5 text-ink-soft">
              {(insights?.conflict_children ?? []).map((c) => <li key={c.child_id}>{c.name} · 갈등 {c.conflicts}건</li>)}
            </ul>
          </>,
    })
  }
  function runCommunity() {
    setColorMode('community')
    applyFocus(null)
    setInsightOpen(true)
    setInsightHtml({
      title: '커뮤니티 구조',
      body: <>
        <p>알고리즘이 탐지한 <strong>{insights?.summary?.communities ?? 0}개</strong>의 또래 군집을 색으로 구분했습니다. 같은 색은 강하게 묶인 하위 그룹입니다.</p>
        <ul className="list-disc list-inside mt-2 space-y-0.5 text-ink-soft">
          {(insights?.communities ?? []).map((c) => <li key={c.community_id}>그룹 {c.community_id} · {c.size}명 ({c.members.slice(0, 4).join(', ')}{c.members.length > 4 ? ' 외' : ''})</li>)}
        </ul>
      </>,
    })
  }
  function reset() {
    setColorMode('class')
    applyFocus(null)
    setInsightOpen(true)
    setInsightHtml({ title: '관계망 개요', body: overviewBody() })
  }
  function overviewBody() {
    const s = insights?.summary
    return (
      <>
        <p>아동 <strong>{s?.children ?? 0}명</strong>, 고립 <strong>{s?.isolated ?? 0}명</strong>, 커뮤니티 <strong>{s?.communities ?? 0}개</strong>로 구성된 다차원 관계망입니다.</p>
        <p className="mt-1.5 text-ink-faint">노드를 클릭하면 해당 관계망만 선명하게 남고 나머지는 흐려집니다. 빈 곳을 클릭하면 전체로 돌아옵니다.</p>
      </>
    )
  }

  async function handleRecompute() {
    if (!centerId) return
    setRecomputing(true)
    try {
      const { error } = await supabase.functions.invoke('recompute_sna_metrics', { body: { center_id: centerId, rebuild: true } })
      if (error) throw error
      router.refresh()
      setInsightHtml({ title: '재계산 완료', body: <p>관계망과 중심성 지표를 다시 계산했습니다.</p> })
      setInsightOpen(true)
    } catch (e) {
      setInsightHtml({ title: '재계산 실패', body: <p className="text-danger">{(e as Error).message}</p> })
      setInsightOpen(true)
    } finally {
      setRecomputing(false)
    }
  }

  // ---- d3 render -------------------------------------------------------
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    if (nodes.length === 0) return

    const width = svgRef.current.clientWidth || 1000
    const height = svgRef.current.clientHeight || 700

    const dNodes: DNode[] = nodes.map((n) => ({ id: n.id, d: n }))
    const dLinks: DLink[] = edges.map((e) => ({ source: e.source_id, target: e.target_id, e }))

    const maxBetw = Math.max(1, ...nodes.map((n) => n.betweenness))
    const radius = (n: SnaNode) => n.kind === 'child' ? 13 + 16 * Math.sqrt(n.betweenness / maxBetw) : 12

    const g = svg.append('g')
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 3]).on('zoom', (ev) => g.attr('transform', ev.transform)))

    const sim = d3.forceSimulation<DNode>(dNodes)
      .force('link', d3.forceLink<DNode, DLink>(dLinks).id((d) => d.id).distance((l) => 110 - Math.min(l.e.strength * 14, 50)))
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<DNode>().radius((d) => radius(d.d) + 10))

    const link = g.append('g').selectAll<SVGLineElement, DLink>('line').data(dLinks).enter().append('line')
      .attr('stroke', (d) => RELATION_COLOR[d.e.relation_type] ?? '#cbd5e1')
      .attr('stroke-width', (d) => Math.min(1.2 + d.e.strength * 1.1, 5))
      .attr('stroke-opacity', 0.75)
      .attr('stroke-dasharray', (d) => (d.e.has_conflict ? '5 3' : null))

    const node = g.append('g').selectAll<SVGGElement, DNode>('g').data(dNodes).enter().append('g')
      .attr('cursor', 'pointer')
      .on('click', (ev, d) => { ev.stopPropagation(); focusNode(d.id) })
      .call(d3.drag<SVGGElement, DNode>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    // children = circles, staff/guardian = rounded rects
    node.each(function (d) {
      const sNode = d3.select(this)
      const c = nodeColor(d.d)
      if (d.d.kind === 'child') {
        sNode.append('circle')
          .attr('r', radius(d.d))
          .attr('fill', c).attr('fill-opacity', d.d.is_isolated ? 0.08 : 0.2)
          .attr('stroke', c).attr('stroke-width', d.d.is_isolated ? 1.2 : 2)
          .attr('stroke-dasharray', d.d.is_isolated ? '3 2' : null)
      } else {
        const w = 22, h = 16
        sNode.append('rect')
          .attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h).attr('rx', d.d.kind === 'staff' ? 8 : 4)
          .attr('fill', c).attr('fill-opacity', 0.18).attr('stroke', c).attr('stroke-width', 2)
      }
    })

    const label = node.append('text')
      .text((d) => d.d.name)
      .attr('text-anchor', 'middle').attr('dy', (d) => d.d.kind === 'child' ? '0.35em' : 26)
      .attr('font-size', 11).attr('font-weight', 500).attr('fill', '#0e1726').attr('pointer-events', 'none')

    svg.on('click', () => reset())

    sim.on('tick', () => {
      link.attr('x1', (d) => (d.source as DNode).x ?? 0).attr('y1', (d) => (d.source as DNode).y ?? 0)
          .attr('x2', (d) => (d.target as DNode).x ?? 0).attr('y2', (d) => (d.target as DNode).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    sel.current.node = node
    sel.current.link = link
    sel.current.fit = (ids) => {
      const pts = ids ? dNodes.filter((n) => ids.includes(n.id)) : dNodes
      if (pts.length === 0) return
      const xs = pts.map((p) => p.x ?? 0), ys = pts.map((p) => p.y ?? 0)
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
      const dx = maxX - minX || 1, dy = maxY - minY || 1
      const scale = Math.min(2.2, 0.85 / Math.max(dx / width, dy / height))
      const tx = width / 2 - scale * (minX + maxX) / 2
      const ty = height / 2 - scale * (minY + maxY) / 2
      svg.transition().duration(700).call(
        d3.zoom<SVGSVGElement, unknown>().on('zoom', (ev) => g.attr('transform', ev.transform)).transform as never,
        d3.zoomIdentity.translate(tx, ty).scale(scale),
      )
    }

    function focusNode(id: string) {
      const set = new Set<string>([id]); adj.get(id)?.forEach((n) => set.add(n))
      applyFocus(set)
      const n = nodes.find((x) => x.id === id)
      if (n) setInsightHtml({
        title: `노드 집중 · ${n.name}`,
        body: <>
          <p><strong>{n.name}</strong>와(과) 직접 연결된 관계망만 표시합니다. {n.kind === 'child' ? '아동' : n.kind === 'staff' ? '교사' : '보호자'} 노드입니다.</p>
          {n.kind === 'child' && <p className="mt-1.5 text-ink-soft">연결 {n.connection_count} · 매개 {n.betweenness.toFixed(2)} · 영향력 {n.eigenvector.toFixed(2)}{n.community_id != null ? ` · 그룹 ${n.community_id}` : ''}</p>}
        </>,
      })
      setInsightOpen(true)
    }

    return () => { sim.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, colorMode])

  // initial overview text
  useEffect(() => { setInsightHtml({ title: '관계망 개요', body: overviewBody() }) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights])

  const SCENARIOS: { key: string; label: string; tone: string; run: () => void }[] = [
    { key: 'isolated', label: '고립 아동 탐지', tone: 'amber', run: runIsolated },
    { key: 'brokers', label: '핵심 매개자 · 튜터링', tone: 'indigo', run: runBrokers },
    { key: 'conflict', label: '갈등 관계 분석', tone: 'rose', run: runConflict },
    { key: 'community', label: '커뮤니티 구조', tone: 'emerald', run: runCommunity },
  ]
  const toneCls: Record<string, string> = {
    amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700',
    indigo: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700',
    rose: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700',
    emerald: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700',
  }

  const LEGEND: { c: string; label: string }[] = [
    { c: KIND_COLOR.child, label: '아동' },
    { c: KIND_COLOR.staff, label: '교사/스태프' },
    { c: KIND_COLOR.guardian, label: '보호자' },
    { c: '#e5484d', label: '갈등 관계' },
    { c: '#94a3b8', label: '고립(점선)' },
  ]

  return (
    <div className="relative flex-1 h-[calc(100vh-3.5rem)] overflow-hidden bg-canvas">
      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-faint">
          <p className="text-sm">표시할 관계망 데이터가 없습니다</p>
          <p className="text-xs text-ink-ghost">평가 · 관계 입력 후 재계산을 실행하세요</p>
          <button onClick={handleRecompute} disabled={recomputing}
            className="mt-2 h-8 px-4 text-[12px] rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50">
            {recomputing ? '재계산 중…' : 'SNA 재계산'}
          </button>
        </div>
      ) : (
        <svg ref={svgRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Control panel */}
      <div className="absolute top-6 left-6 z-10 w-[320px] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface/95 backdrop-blur-md shadow-[var(--shadow-pop)] p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-[13px] font-bold">L</span>
          </div>
          <h1 className="text-[15px] font-semibold text-ink tracking-[-0.01em]">SOCIAL NETWORK ANALYSIS</h1>
        </div>
        <p className="text-[11px] text-ink-faint mb-4 pb-4 border-b border-line">ONTOLOGY 기반 다차원 관계망 분석</p>

        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2">범례</p>
        <ul className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-ink-soft mb-4 pb-4 border-b border-line">
          {LEGEND.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.c }} />{l.label}
            </li>
          ))}
        </ul>

        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2">분석 시나리오</p>
        <div className="space-y-1.5">
          {SCENARIOS.map((s) => (
            <button key={s.key} onClick={s.run}
              className={`w-full py-2 px-3 border rounded-xl text-[12.5px] font-medium text-left transition-colors ${toneCls[s.tone]}`}>
              {s.label}
            </button>
          ))}
          <button onClick={reset} className="w-full mt-1 py-2 px-3 rounded-xl bg-ink text-white text-[12.5px] font-medium hover:opacity-90 transition-opacity">
            전체 보기 초기화
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-line flex items-center gap-2">
          <select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)}
            className="flex-1 bg-surface border border-line rounded-lg px-2.5 h-8 text-[12px] text-ink-soft focus:outline-none focus:border-accent cursor-pointer">
            <option value="class">색상: 반</option>
            <option value="community">색상: 커뮤니티</option>
            <option value="kind">색상: 노드 유형</option>
          </select>
          <button onClick={handleRecompute} disabled={recomputing}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-accent text-white text-[12px] font-medium hover:bg-accent-hover disabled:opacity-50">
            <RefreshCw size={13} className={recomputing ? 'animate-spin' : ''} /> 재계산
          </button>
        </div>
      </div>

      {/* Insight panel */}
      {insightOpen && (
        <div className="absolute bottom-6 left-6 z-10 w-[400px] max-w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface/95 backdrop-blur-md shadow-[var(--shadow-pop)] p-5">
          <div className="flex items-start justify-between border-b border-line pb-2.5 mb-3">
            <h3 className="text-[14px] font-semibold text-ink">{insightHtml.title}</h3>
            <button onClick={() => setInsightOpen(false)} className="text-ink-faint hover:text-ink hover:bg-fill rounded-md p-1 transition-colors">
              <X size={15} />
            </button>
          </div>
          <div className="text-[13px] text-ink-soft leading-relaxed space-y-2">{insightHtml.body}</div>
        </div>
      )}
    </div>
  )
}
