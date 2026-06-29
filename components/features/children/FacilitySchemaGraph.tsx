'use client'

import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Building2, Users, BookOpen, ChevronRight, Search, Move } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const MIN_ZOOM = 0.6, MAX_ZOOM = 1.8
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

interface GChild { id: string; name: string; gender?: string | null; status: string }
interface GClass { id: string; name: string; children: GChild[] }
interface Props { facilityName: string; classes: GClass[]; unassigned: GChild[] }

const CW = 168, CH = 44, KW = 150, KH = 28
const COL_F = 16, COL_C = 220, COL_K = 432

// colorful gender index (item 5)
function genderStyle(g?: string | null) {
  if (g === 'male') return { dot: '#3b7fb0', chip: 'bg-[#e8f1f8] text-[#2b6ca3] border-[#bcd9ef]', label: '남아', short: '남' }
  if (g === 'female') return { dot: '#d6669a', chip: 'bg-[#fbe9f1] text-[#b03b6e] border-[#f3c2d8]', label: '여아', short: '여' }
  return { dot: '#94a3b8', chip: 'bg-fill text-ink-faint border-line', label: '기타', short: '·' }
}

export function FacilitySchemaGraph({ facilityName, classes, unassigned }: Props) {
  const router = useRouter()
  const [sel, setSel] = useState<string>('facility') // 'facility' | classId | 'unassigned'
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  // per-node position overrides — nodes are freely draggable on the canvas (item 4)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const posOf = (id: string, dx: number, dy: number) => positions[id] ?? { x: dx, y: dy }

  const zoomRef = useRef(1); zoomRef.current = zoom
  function startDrag(e: React.PointerEvent, id: string, dx: number, dy: number) {
    e.stopPropagation()
    const cur = posOf(id, dx, dy)
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function moveDrag(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true
    const ddx = (e.clientX - d.sx) / zoomRef.current, ddy = (e.clientY - d.sy) / zoomRef.current
    setPositions((p) => ({ ...p, [d.id]: { x: Math.max(0, d.ox + ddx), y: Math.max(0, d.oy + ddy) } }))
  }
  function endDrag(onClick: () => void) {
    const d = drag.current; drag.current = null
    if (d && !d.moved) onClick()
  }

  // wheel zoom (with limits); preventDefault so it zooms instead of scrolling
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const groups = useMemo(() => {
    const g = classes.map((c) => ({ id: c.id, name: c.name, children: c.children ?? [] }))
    if (unassigned.length) g.push({ id: 'unassigned', name: '미배정', children: unassigned })
    return g
  }, [classes, unassigned])

  const totalChildren = useMemo(() => groups.reduce((a, c) => a + c.children.length, 0), [groups])
  const filteredGroups = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return groups
    return groups.filter((c) => c.name.toLowerCase().includes(s) || c.children.some((k) => k.name.toLowerCase().includes(s)))
  }, [groups, q])

  const selGroup = groups.find((c) => c.id === sel) ?? null
  const selChildren = useMemo(() => {
    const list = selGroup?.children ?? []
    const s = q.trim().toLowerCase()
    return s ? list.filter((k) => k.name.toLowerCase().includes(s)) : list
  }, [selGroup, q])

  // default layout coordinates
  const classY = (i: number) => 18 + i * (CH + 16)
  const blockH = Math.max(classY(filteredGroups.length - 1) + CH + 18, 140)
  const facilityY = Math.max(18, blockH / 2 - CH / 2)
  const childCol = selGroup && sel !== 'facility' ? selChildren : []
  const selIndex = filteredGroups.findIndex((c) => c.id === sel)

  // canvas extends to fit any dragged node
  const baseH = Math.max(blockH, 18 + childCol.length * (KH + 10) + 18)
  const px = Object.values(positions)
  const canvasW = Math.max(COL_K + KW + 24, ...px.map((p) => p.x + CW + 24))
  const canvasH = Math.max(baseH, ...px.map((p) => p.y + CH + 24))

  const cx = (x: number, w: number) => x + w
  const linkPath = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`

  const fp = posOf('facility', COL_F, facilityY)

  return (
    <div className="flex gap-3 h-full min-h-0">
      <div className="flex-1 min-w-0 border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
        <div className="h-9 px-3 flex items-center justify-between border-b border-line bg-fill-2 shrink-0">
          <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">시설 · 반 · 아동 스키마 그래프</span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 h-7 w-[160px] bg-surface border border-line rounded-[3px]">
              <Search size={12} className="text-ink-faint shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="반·아동 검색" className="flex-1 min-w-0 bg-transparent text-[11px] text-ink placeholder:text-ink-ghost outline-none" />
            </div>
            {Object.keys(positions).length > 0 && (
              <button onClick={() => setPositions({})} title="배치 초기화" className="h-7 px-2 text-[10px] text-ink-soft border border-line rounded-[3px] hover:bg-fill">배치 초기화</button>
            )}
            <div className="flex items-center border border-line rounded-[3px] overflow-hidden">
              <button onClick={() => setZoom((z) => clampZoom(z / 1.1))} className="w-6 h-7 text-ink-soft hover:bg-fill text-[13px]">−</button>
              <span className="w-9 text-center text-[10px] font-data text-ink-faint tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => clampZoom(z * 1.1))} className="w-6 h-7 text-ink-soft hover:bg-fill text-[13px]">+</button>
            </div>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-fill-2" style={{ backgroundImage: 'linear-gradient(#e7ecf1 1px, transparent 1px), linear-gradient(90deg, #e7ecf1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <div style={{ width: canvasW * zoom, height: canvasH * zoom }}>
          <div className="relative origin-top-left" style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})` }}>
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ width: canvasW, height: canvasH }}>
              {filteredGroups.map((c, i) => {
                const cp = posOf(c.id, COL_C, classY(i))
                return (
                  <path key={c.id} d={linkPath(cx(fp.x, CW), fp.y + CH / 2, cp.x, cp.y + CH / 2)}
                    fill="none" stroke={sel === c.id ? '#137cbd' : '#c1ccd6'} strokeWidth={sel === c.id ? 2 : 1.3} />
                )
              })}
              {sel !== 'facility' && selGroup && selIndex >= 0 && childCol.map((k, j) => {
                const cp = posOf(sel, COL_C, classY(selIndex))
                const kp = posOf(k.id, COL_K, 18 + j * (KH + 10))
                return <path key={k.id} d={linkPath(cx(cp.x, CW), cp.y + CH / 2, kp.x, kp.y + KH / 2)}
                  fill="none" stroke="#0f9960" strokeWidth={1.3} opacity={0.7} />
              })}
            </svg>

            {/* facility node */}
            <div onPointerDown={(e) => startDrag(e, 'facility', COL_F, facilityY)} onPointerMove={moveDrag} onPointerUp={() => endDrag(() => setSel('facility'))}
              style={{ left: fp.x, top: fp.y, width: CW, height: CH }}
              className={`group absolute flex items-center gap-2 px-3 rounded-[4px] border bg-surface shadow-[var(--shadow-card)] text-left cursor-grab active:cursor-grabbing ${sel === 'facility' ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
              <span className="w-6 h-6 rounded-[3px] bg-accent-soft flex items-center justify-center shrink-0"><Building2 size={13} className="text-accent" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-ink truncate">{facilityName}</span><span className="block text-[9px] text-ink-faint">아동 {totalChildren} · 반 {classes.length}</span></span>
              <Move size={10} className="text-ink-ghost opacity-0 group-hover:opacity-100 shrink-0" />
            </div>

            {/* class nodes */}
            {filteredGroups.map((c, i) => {
              const active = c.children.filter((k) => k.status === 'active').length
              const on = sel === c.id
              const cp = posOf(c.id, COL_C, classY(i))
              return (
                <div key={c.id} onPointerDown={(e) => startDrag(e, c.id, COL_C, classY(i))} onPointerMove={moveDrag} onPointerUp={() => endDrag(() => setSel(c.id))}
                  style={{ left: cp.x, top: cp.y, width: CW, height: CH }}
                  className={`group absolute flex items-center gap-2 px-2.5 rounded-[4px] border bg-surface shadow-[var(--shadow-card)] text-left cursor-grab active:cursor-grabbing ${on ? 'border-success ring-1 ring-success/40' : 'border-line hover:border-success/50'}`}>
                  <span className="w-5 h-5 rounded-[3px] bg-success-soft flex items-center justify-center shrink-0"><BookOpen size={11} className="text-success" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-ink truncate">{c.name}</span><span className="block text-[9px] text-ink-faint">재원 {active}명</span></span>
                  <ChevronRight size={12} className="text-ink-ghost shrink-0 group-hover:hidden" />
                  <Move size={10} className="text-ink-ghost hidden group-hover:block shrink-0" />
                </div>
              )
            })}

            {/* selected class children nodes — draggable; click navigates */}
            {sel !== 'facility' && childCol.map((k, j) => {
              const kp = posOf(k.id, COL_K, 18 + j * (KH + 10))
              const g = genderStyle(k.gender)
              return (
                <div key={k.id} onPointerDown={(e) => startDrag(e, k.id, COL_K, 18 + j * (KH + 10))} onPointerMove={moveDrag} onPointerUp={() => endDrag(() => router.push(`/children/${k.id}`))}
                  style={{ left: kp.x, top: kp.y, width: KW, height: KH }}
                  className="absolute flex items-center gap-1.5 px-2 rounded-[3px] border border-line bg-surface shadow-[var(--shadow-card)] hover:border-accent/60 cursor-grab active:cursor-grabbing">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: k.status === 'active' ? g.dot : '#a7b6c2' }} />
                  <span className="text-[11px] text-ink truncate flex-1">{k.name}</span>
                  <span className={`text-[9px] px-1 py-px rounded-[2px] border shrink-0 ${g.chip}`}>{g.short}</span>
                </div>
              )
            })}
          </div>
          </div>
        </div>
      </div>

      {/* roster panel */}
      <div className="w-[248px] shrink-0 border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-line shrink-0">
          <p className="text-[12px] font-semibold text-ink truncate">{sel === 'facility' ? facilityName : selGroup?.name ?? '명단'}</p>
          <p className="text-[10px] text-ink-faint mt-0.5">{sel === 'facility' ? `전체 아동 ${totalChildren}명 · ${classes.length}개 반` : `${selChildren.length}명`}</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {sel === 'facility' ? (
            groups.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[3px] hover:bg-fill text-left">
                <span className="flex items-center gap-2 min-w-0"><BookOpen size={12} className="text-success shrink-0" /><span className="text-[12px] text-ink truncate">{c.name}</span></span>
                <span className="text-[11px] font-data text-ink-faint tabular-nums shrink-0">{c.children.filter((k) => k.status === 'active').length}</span>
              </button>
            ))
          ) : selChildren.length === 0 ? (
            <p className="text-[11px] text-ink-ghost text-center py-6">명단이 비어 있습니다</p>
          ) : (
            selChildren.map((k) => {
              const g = genderStyle(k.gender)
              return (
                <Link key={k.id} href={`/children/${k.id}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] hover:bg-fill">
                  <span className="w-6 h-6 rounded-[2px] flex items-center justify-center shrink-0 text-[9px] font-semibold border" style={{ background: g.dot + '1a', color: g.dot, borderColor: g.dot + '55' }}>{k.name[0]}</span>
                  <span className="flex-1 min-w-0"><span className="block text-[12px] text-ink truncate">{k.name}</span><span className="block text-[9px]" style={{ color: g.dot }}>{g.label}</span></span>
                  <Badge className={CHILD_STATUS_COLORS[k.status as keyof typeof CHILD_STATUS_COLORS]}>{CHILD_STATUS_LABELS[k.status as keyof typeof CHILD_STATUS_LABELS]}</Badge>
                </Link>
              )
            })
          )}
        </div>
        <div className="px-3 py-2 border-t border-line shrink-0 flex items-center gap-1.5 text-[10px] text-ink-faint">
          <Move size={11} /> 노드를 드래그해 배치하거나 클릭해 조회하세요
        </div>
      </div>
    </div>
  )
}
