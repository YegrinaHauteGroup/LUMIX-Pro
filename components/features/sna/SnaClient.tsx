'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Child, Activity, Class } from '@/lib/types'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface ChildNode extends Pick<Child, 'id' | 'name' | 'class_id' | 'status'> {}
interface ActivityItem extends Pick<Activity, 'id' | 'title' | 'class_id' | 'type'> {}
interface ClassItem extends Pick<Class, 'id' | 'name'> {}

interface Props {
  children: ChildNode[]
  classes: ClassItem[]
  activities: ActivityItem[]
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  classId: string | null
  className: string | null
  connections: number
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node
  target: string | D3Node
  strength: number
}

const CLASS_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#a3e635',
]

export function SnaClient({ children, classes, activities }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<D3Node | null>(null)
  const [filterClass, setFilterClass] = useState<string>('all')

  const classColorMap: Record<string, string> = {}
  classes.forEach((cls, i) => {
    classColorMap[cls.id] = CLASS_COLORS[i % CLASS_COLORS.length]
  })

  const filteredChildren = filterClass === 'all'
    ? children
    : children.filter((c) => c.class_id === filterClass)

  // Build SNA: children connected by shared class
  const nodes: D3Node[] = filteredChildren.map((c) => {
    const cls = classes.find((cl) => cl.id === c.class_id)
    const classmates = filteredChildren.filter(
      (other) => other.id !== c.id && other.class_id === c.class_id
    ).length
    const activityConnections = activities.filter(
      (a) => a.class_id === c.class_id
    ).length
    return {
      id: c.id,
      name: c.name,
      classId: c.class_id,
      className: cls?.name ?? null,
      connections: classmates + activityConnections,
    }
  })

  const linksMap: Map<string, D3Link> = new Map()
  filteredChildren.forEach((child) => {
    const classmates = filteredChildren.filter(
      (other) => other.id !== child.id && other.class_id === child.class_id
    )
    classmates.forEach((mate) => {
      const key = [child.id, mate.id].sort().join('|')
      if (!linksMap.has(key)) {
        const sharedActivities = activities.filter(
          (a) => a.class_id === child.class_id
        ).length
        linksMap.set(key, {
          source: child.id,
          target: mate.id,
          strength: sharedActivities + 1,
        })
      }
    })
  })

  const links: D3Link[] = Array.from(linksMap.values())

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 500

    const g = svg.append('g')

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    svg.call(zoom)

    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id((d) => d.id)
        .distance((l) => 80 - Math.min((l.strength ?? 1) * 5, 40))
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(28))

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#2a2a2a')
      .attr('stroke-width', (d) => Math.min((d.strength ?? 1) * 0.8, 3))
      .attr('stroke-opacity', 0.8)

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => setSelected(d))
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
          })
      )

    // Circle
    node.append('circle')
      .attr('r', (d) => 14 + Math.min(d.connections * 1.5, 10))
      .attr('fill', (d) => d.classId ? classColorMap[d.classId] ?? '#6366f1' : '#444444')
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => d.classId ? classColorMap[d.classId] ?? '#6366f1' : '#444444')
      .attr('stroke-width', 1.5)

    // Label
    node.append('text')
      .text((d) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 11)
      .attr('fill', '#e0e0e0')
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
  }, [nodes.length, links.length, filterClass])

  const stats = {
    nodes: nodes.length,
    links: links.length,
    density: nodes.length > 1
      ? ((links.length * 2) / (nodes.length * (nodes.length - 1)) * 100).toFixed(1)
      : '0.0',
    isolated: nodes.filter((n) => !links.some(
      (l) => (l.source as D3Node).id === n.id || (l.target as D3Node).id === n.id
    )).length,
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#0e0e0e] border border-[#1e1e1e] px-3 text-[12px] text-[#888888] focus:outline-none focus:border-[#333333] h-8 rounded-sm cursor-pointer"
        >
          <option value="all">전체 반</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        <span className="text-xs text-[#555555]">
          드래그로 노드 이동 · 스크롤로 확대/축소
        </span>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Graph */}
        <Card className="flex-1">
          <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-4">
            {classes.map((cls, i) => (
              <div key={cls.id} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                <span className="text-xs text-[#a0a0a0]">{cls.name}</span>
              </div>
            ))}
          </div>
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-80 text-[#444444] text-sm">
              재원 아동이 없거나 반이 배정되지 않았습니다
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="w-full h-[500px]"
              style={{ background: 'transparent' }}
            />
          )}
        </Card>

        {/* Side panel */}
        <div className="w-60 space-y-4">
          {/* Stats */}
          <Card>
            <CardHeader><CardTitle>네트워크 지표</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: '노드 수 (아동)', value: stats.nodes },
                { label: '연결 수 (관계)', value: stats.links },
                { label: '네트워크 밀도', value: `${stats.density}%` },
                { label: '고립 아동', value: stats.isolated },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[#666666]">{label}</span>
                  <span className="text-sm font-semibold text-[#e0e0e0]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected node info */}
          {selected && (
            <Card>
              <CardHeader><CardTitle>선택된 아동</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{
                      background: selected.classId ? `${classColorMap[selected.classId]}22` : '#222',
                      border: `1.5px solid ${selected.classId ? classColorMap[selected.classId] ?? '#6366f1' : '#444'}`,
                      color: selected.classId ? classColorMap[selected.classId] ?? '#6366f1' : '#666',
                    }}
                  >
                    {selected.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#e0e0e0]">{selected.name}</p>
                    <p className="text-xs text-[#555555]">{selected.className ?? '반 미배정'}</p>
                  </div>
                </div>
                <div className="border-t border-[#1a1a1a] pt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#666666]">연결 수</span>
                    <span className="text-[#e0e0e0]">{selected.connections}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top connected */}
          <Card>
            <CardHeader><CardTitle>연결 중심성 상위</CardTitle></CardHeader>
            <CardContent>
              {nodes.length === 0 ? (
                <p className="text-xs text-[#444444]">데이터 없음</p>
              ) : (
                <div className="space-y-2">
                  {[...nodes]
                    .sort((a, b) => b.connections - a.connections)
                    .slice(0, 5)
                    .map((n, i) => (
                      <div key={n.id} className="flex items-center gap-2">
                        <span className="text-xs text-[#444444] w-4">{i + 1}</span>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
                          style={{
                            background: n.classId ? `${classColorMap[n.classId]}22` : '#222',
                            color: n.classId ? classColorMap[n.classId] ?? '#6366f1' : '#666',
                          }}
                        >
                          {n.name[0]}
                        </div>
                        <span className="text-xs text-[#a0a0a0] flex-1 truncate">{n.name}</span>
                        <span className="text-xs text-[#555555]">{n.connections}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
