'use client'

import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Building2, Users, BookOpen, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

const MIN_ZOOM = 0.6, MAX_ZOOM = 1.8
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

interface GChild { id: string; name: string; gender?: string | null; status: string }
interface GClass { id: string; name: string; children: GChild[] }
interface Props { facilityName: string; classes: GClass[]; unassigned: GChild[] }

const CW = 168, CH = 44, KW = 150, KH = 28
const COL_F = 16, COL_C = 220, COL_K = 432

export function FacilitySchemaGraph({ facilityName, classes, unassigned }: Props) {
  const [sel, setSel] = useState<string>('facility') // 'facility' | classId | 'unassigned'
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  // wheel zoom (with limits); preventDefault so it zooms instead of scrolling
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // group nodes: real classes + a synthetic "미배정" group when needed
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

  // layout coordinates
  const classY = (i: number) => 18 + i * (CH + 16)
  const blockH = Math.max(classY(filteredGroups.length - 1) + CH + 18, 140)
  const facilityY = Math.max(18, blockH / 2 - CH / 2)
  const childCol = selGroup && sel !== 'facility' ? selChildren : []
  const canvasH = Math.max(blockH, 18 + childCol.length * (KH + 10) + 18)
  const canvasW = COL_K + KW + 24

  const cx = (x: number, w: number) => x + w
  const linkPath = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* graph canvas */}
      <div className="flex-1 min-w-0 border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
        <div className="h-9 px-3 flex items-center justify-between border-b border-line bg-fill-2 shrink-0">
          <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">시설 · 반 · 아동 스키마 그래프</span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 h-7 w-[160px] bg-surface border border-line rounded-[3px]">
              <Search size={12} className="text-ink-faint shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="반·아동 검색" className="flex-1 min-w-0 bg-transparent text-[11px] text-ink placeholder:text-ink-ghost outline-none" />
            </div>
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
              {/* facility → classes */}
              {filteredGroups.map((c, i) => (
                <path key={c.id} d={linkPath(cx(COL_F, CW), facilityY + CH / 2, COL_C, classY(i) + CH / 2)}
                  fill="none" stroke={sel === c.id ? '#137cbd' : '#c1ccd6'} strokeWidth={sel === c.id ? 2 : 1.3} />
              ))}
              {/* selected class → children */}
              {sel !== 'facility' && selGroup && childCol.map((k, j) => {
                const i = filteredGroups.findIndex((c) => c.id === sel)
                if (i < 0) return null
                return <path key={k.id} d={linkPath(cx(COL_C, CW), classY(i) + CH / 2, COL_K, 18 + j * (KH + 10) + KH / 2)}
                  fill="none" stroke="#0f9960" strokeWidth={1.3} opacity={0.7} />
              })}
            </svg>

            {/* facility node */}
            <button onClick={() => setSel('facility')} style={{ left: COL_F, top: facilityY, width: CW, height: CH }}
              className={`absolute flex items-center gap-2 px-3 rounded-[4px] border bg-surface shadow-[var(--shadow-card)] text-left ${sel === 'facility' ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
              <span className="w-6 h-6 rounded-[3px] bg-accent-soft flex items-center justify-center shrink-0"><Building2 size={13} className="text-accent" /></span>
              <span className="min-w-0"><span className="block text-[12px] font-semibold text-ink truncate">{facilityName}</span><span className="block text-[9px] text-ink-faint">아동 {totalChildren} · 반 {classes.length}</span></span>
            </button>

            {/* class nodes */}
            {filteredGroups.map((c, i) => {
              const active = c.children.filter((k) => k.status === 'active').length
              const on = sel === c.id
              return (
                <button key={c.id} onClick={() => setSel(c.id)} style={{ left: COL_C, top: classY(i), width: CW, height: CH }}
                  className={`absolute flex items-center gap-2 px-2.5 rounded-[4px] border bg-surface shadow-[var(--shadow-card)] text-left ${on ? 'border-success ring-1 ring-success/40' : 'border-line hover:border-success/50'}`}>
                  <span className="w-5 h-5 rounded-[3px] bg-success-soft flex items-center justify-center shrink-0"><BookOpen size={11} className="text-success" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-ink truncate">{c.name}</span><span className="block text-[9px] text-ink-faint">재원 {active}명</span></span>
                  <ChevronRight size={12} className="text-ink-ghost shrink-0" />
                </button>
              )
            })}

            {/* selected class children nodes */}
            {sel !== 'facility' && childCol.map((k, j) => (
              <Link key={k.id} href={`/children/${k.id}`} style={{ left: COL_K, top: 18 + j * (KH + 10), width: KW, height: KH }}
                className="absolute flex items-center gap-1.5 px-2 rounded-[3px] border border-line bg-surface shadow-[var(--shadow-card)] hover:border-accent/60">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: k.status === 'active' ? '#0f9960' : '#a7b6c2' }} />
                <span className="text-[11px] text-ink truncate flex-1">{k.name}</span>
                <span className="text-[9px] text-ink-ghost shrink-0">{k.gender === 'male' ? '남' : k.gender === 'female' ? '여' : ''}</span>
              </Link>
            ))}
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
            selChildren.map((k) => (
              <Link key={k.id} href={`/children/${k.id}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] hover:bg-fill">
                <span className="w-6 h-6 rounded-[2px] bg-fill-2 border border-line flex items-center justify-center shrink-0 text-[9px] text-ink-soft">{k.name[0]}</span>
                <span className="flex-1 min-w-0"><span className="block text-[12px] text-ink truncate">{k.name}</span><span className="block text-[9px] text-ink-faint">{k.gender === 'male' ? '남아' : k.gender === 'female' ? '여아' : '기타'}</span></span>
                <Badge className={CHILD_STATUS_COLORS[k.status as keyof typeof CHILD_STATUS_COLORS]}>{CHILD_STATUS_LABELS[k.status as keyof typeof CHILD_STATUS_LABELS]}</Badge>
              </Link>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t border-line shrink-0 flex items-center gap-1.5 text-[10px] text-ink-faint">
          <Users size={11} /> 노드를 클릭해 명단을 조회하세요
        </div>
      </div>
    </div>
  )
}
