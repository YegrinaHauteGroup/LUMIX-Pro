'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'

interface SnaNodeData {
  child_id: string
  name: string
  class_id: string | null
  class_name: string | null
  connection_count: number
  weighted_degree: number
  in_degree: number
  out_degree: number
  betweenness: number
  closeness: number
  eigenvector: number
  clustering: number
  degree_centrality: number
  community_id: number | null
  is_isolated: boolean
}

interface SnaEdgeData {
  source_id: string
  target_id: string
  strength: number
  relation_types: string[]
  has_conflict: boolean
}

interface ClassItem { id: string; name: string }

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
  nodes: SnaNodeData[]
  edges: SnaEdgeData[]
  insights: Insights | null
  classes: ClassItem[]
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  data: SnaNodeData
}
interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node
  target: string | D3Node
  strength: number
  hasConflict: boolean
  relationTypes: string[]
}

const PALETTE = [
  '#5a63f2', '#22c55e', '#f59e0b', '#e5484d', '#8b5cf6',
  '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#a3e635',
]

type SizeMetric = 'connection_count' | 'betweenness' | 'eigenvector' | 'closeness'
type ColorMode = 'class' | 'community'

const SIZE_LABELS: Record<SizeMetric, string> = {
  connection_count: '연결 수 (Degree)',
  betweenness: '매개 중심성 (Betweenness)',
  eigenvector: '영향력 (Eigenvector)',
  closeness: '근접 중심성 (Closeness)',
}

export function SnaClient({ centerId, nodes, edges, insights, classes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const router = useRouter()
  const [selected, setSelected] = useState<SnaNodeData | null>(null)
  const [filterClass, setFilterClass] = useState<string>('all')
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('connection_count')
  const [colorMode, setColorMode] = useState<ColorMode>('class')
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null)

  const classColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    classes.forEach((cls, i) => { m[cls.id] = PALETTE[i % PALETTE.length] })
    return m
  }, [classes])

  const communityColor = (id: number | null) =>
    id == null ? '#8a93a6' : PALETTE[id % PALETTE.length]

  const nodeColor = (n: SnaNodeData) =>
    colorMode === 'community'
      ? communityColor(n.community_id)
      : (n.class_id ? classColorMap[n.class_id] ?? '#5a63f2' : '#8a93a6')

  const filteredNodes = useMemo(
    () => nodes.filter((n) => filterClass === 'all' || n.class_id === filterClass),
    [nodes, filterClass],
  )

  const nodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.child_id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => edges.filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)),
    [edges, nodeIds],
  )

  async function handleRecompute() {
    if (!centerId) return
    setRecomputing(true)
    setRecomputeMsg(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('recompute_sna_metrics', {
        body: { center_id: centerId, rebuild: true },
      })
      if (error) throw error
      setRecomputeMsg(
        `재계산 완료 · 노드 ${data?.nodes ?? 0} · 직접연결 ${data?.child_child_edges ?? 0} · 추론연결 ${data?.inferred_edges ?? 0}`,
      )
      router.refresh()
    } catch (e) {
      setRecomputeMsg(`재계산 실패: ${(e as Error).message}`)
    } finally {
      setRecomputing(false)
    }
  }

  useEffect(() => {
    if (!svgRef.current || filteredNodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 500

    const d3Nodes: D3Node[] = filteredNodes.map((n) => ({ id: n.child_id, data: n }))
    const d3Links: D3Link[] = filteredEdges.map((e) => ({
      source: e.source_id,
      target: e.target_id,
      strength: e.strength,
      hasConflict: e.has_conflict,
      relationTypes: e.relation_types ?? [],
    }))

    // size scale based on chosen metric
    const metricVals = d3Nodes.map((d) => (d.data[sizeMetric] as number) ?? 0)
    const maxVal = Math.max(1, ...metricVals)
    const radius = (d: D3Node) => 12 + 16 * Math.sqrt(((d.data[sizeMetric] as number) ?? 0) / maxVal)

    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links)
        .id((d) => d.id)
        .distance((l) => 90 - Math.min((l.strength ?? 1) * 18, 50)))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>().radius((d) => radius(d) + 6))

    const link = g.append('g')
      .selectAll('line')
      .data(d3Links)
      .enter()
      .append('line')
      .attr('stroke', (d) => (d.hasConflict ? '#e5484d' : '#c4ccd9'))
      .attr('stroke-width', (d) => Math.min(1 + (d.strength ?? 1) * 1.2, 5))
      .attr('stroke-opacity', (d) => (d.hasConflict ? 0.9 : 0.7))
      .attr('stroke-dasharray', (d) => (d.hasConflict ? '4 2' : null))

    const node = g.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => setSelected(d.data))
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          }),
      )

    node.append('circle')
      .attr('r', radius)
      .attr('fill', (d) => nodeColor(d.data))
      .attr('fill-opacity', (d) => (d.data.is_isolated ? 0.05 : 0.22))
      .attr('stroke', (d) => (d.data.is_isolated ? '#666' : nodeColor(d.data)))
      .attr('stroke-width', (d) => (d.data.is_isolated ? 1 : 1.8))
      .attr('stroke-dasharray', (d) => (d.data.is_isolated ? '3 2' : null))

    node.append('text')
      .text((d) => d.data.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 11)
      .attr('fill', '#0e1726')
      .attr('pointer-events', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x ?? 0)
        .attr('y1', (d) => (d.source as D3Node).y ?? 0)
        .attr('x2', (d) => (d.target as D3Node).x ?? 0)
        .attr('y2', (d) => (d.target as D3Node).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [filteredNodes, filteredEdges, sizeMetric, colorMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = {
    nodes: filteredNodes.length,
    links: filteredEdges.length,
    density: filteredNodes.length > 1
      ? ((filteredEdges.length * 2) / (filteredNodes.length * (filteredNodes.length - 1)) * 100).toFixed(1)
      : '0.0',
    isolated: filteredNodes.filter((n) => n.is_isolated).length,
    communities: new Set(filteredNodes.map((n) => n.community_id).filter((c) => c != null)).size,
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer"
        >
          <option value="all">전체 반</option>
          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
        </select>

        <select
          value={sizeMetric}
          onChange={(e) => setSizeMetric(e.target.value as SizeMetric)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer"
        >
          {Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>크기: {v}</option>)}
        </select>

        <select
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as ColorMode)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer"
        >
          <option value="class">색상: 반</option>
          <option value="community">색상: 커뮤니티</option>
        </select>

        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="h-8 px-4 text-[12px] rounded-sm bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {recomputing ? '재계산 중…' : 'SNA 재계산'}
        </button>

        {recomputeMsg && <span className="text-xs text-[#667085]">{recomputeMsg}</span>}
        <span className="text-xs text-[#7a8499] ml-auto">드래그 이동 · 스크롤 확대/축소 · 빨간 점선=갈등</span>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card className="flex-1">
          <div className="p-4 border-b border-[#e9edf4] flex items-center gap-4 flex-wrap">
            {(colorMode === 'class' ? classes.map((cls, i) => ({ key: cls.id, label: cls.name, color: PALETTE[i % PALETTE.length] }))
              : Array.from(new Set(filteredNodes.map((n) => n.community_id).filter((c) => c != null))).map((cid) => ({
                key: String(cid), label: `커뮤니티 ${cid}`, color: communityColor(cid as number),
              }))).map((item) => (
              <div key={item.key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                <span className="text-xs text-[#475467]">{item.label}</span>
              </div>
            ))}
          </div>
          {filteredNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-[#8a93a6] text-sm gap-2">
              <p>표시할 관계망 데이터가 없습니다</p>
              <p className="text-xs text-[#555]">평가 데이터 입력 후 “SNA 재계산”을 눌러주세요</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-[500px]" style={{ background: 'transparent' }} />
          )}
        </Card>

        <div className="w-64 space-y-4 overflow-y-auto">
          <Card>
            <CardHeader><CardTitle>네트워크 지표</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: '노드 수 (아동)', value: stats.nodes },
                { label: '연결 수 (관계)', value: stats.links },
                { label: '네트워크 밀도', value: `${stats.density}%` },
                { label: '커뮤니티 수', value: stats.communities },
                { label: '고립 아동', value: stats.isolated },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[#667085]">{label}</span>
                  <span className="text-sm font-semibold text-[#0e1726]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader><CardTitle>선택된 아동</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{
                      background: `${nodeColor(selected)}22`,
                      border: `1.5px solid ${nodeColor(selected)}`,
                      color: nodeColor(selected),
                    }}
                  >
                    {selected.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0e1726]">{selected.name}</p>
                    <p className="text-xs text-[#7a8499]">{selected.class_name ?? '반 미배정'}</p>
                  </div>
                </div>
                <div className="border-t border-[#e9edf4] pt-2 space-y-1">
                  {[
                    ['연결 수', selected.connection_count],
                    ['가중 연결', selected.weighted_degree?.toFixed(2)],
                    ['받은 관계(in)', selected.in_degree],
                    ['매개 중심성', selected.betweenness?.toFixed(2)],
                    ['근접 중심성', selected.closeness?.toFixed(3)],
                    ['영향력(eig)', selected.eigenvector?.toFixed(3)],
                    ['군집 계수', selected.clustering?.toFixed(2)],
                    ['커뮤니티', selected.community_id ?? '-'],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between text-xs">
                      <span className="text-[#667085]">{k}</span>
                      <span className="text-[#0e1726]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {insights && (
            <Card>
              <CardHeader><CardTitle>분석 인사이트</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InsightList title="핵심 매개자 (브로커)" color="#22c55e"
                  items={(insights.top_brokers ?? []).map((b) => `${b.name} · ${b.betweenness.toFixed(1)}`)} />
                <InsightList title="영향력 상위" color="#5a63f2"
                  items={(insights.most_influential ?? []).map((b) => `${b.name} · ${b.eigenvector.toFixed(2)}`)} />
                <InsightList title="고립 위험 아동" color="#f59e0b"
                  items={(insights.isolated ?? []).map((b) => `${b.name}${b.class_name ? ` (${b.class_name})` : ''}`)}
                  empty="없음" />
                <InsightList title="갈등 관계 아동" color="#e5484d"
                  items={(insights.conflict_children ?? []).map((b) => `${b.name} · ${b.conflicts}건`)}
                  empty="없음" />
                <div className="flex justify-between text-xs pt-1 border-t border-[#e9edf4]">
                  <span className="text-[#667085]">반 경계를 넘는 연결</span>
                  <span className="text-[#0e1726]">{insights.cross_class_links ?? 0}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function InsightList({ title, color, items, empty }: { title: string; color: string; items: string[]; empty?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-xs font-medium text-[#475467]">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#8a93a6] pl-3.5">{empty ?? '데이터 없음'}</p>
      ) : (
        <ul className="pl-3.5 space-y-0.5">
          {items.map((it, i) => <li key={i} className="text-xs text-[#5a6678] truncate">{it}</li>)}
        </ul>
      )}
    </div>
  )
}
