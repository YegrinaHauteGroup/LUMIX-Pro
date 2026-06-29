'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from '@/lib/utils'

type ActType = 'education' | 'therapy' | 'recreation' | 'counseling' | 'other'
interface ActEvent { id: string; title: string; type: ActType; status: string; activity_date: string; activity_time: string | null }
interface CareNote { id: string; child_id: string; content: string; noted_on: string; note_type: string; child_name: string }

const TYPE_DOT: Record<string, string> = {
  education: '#137cbd', therapy: '#8b5cf6', recreation: '#0f9960', counseling: '#d9822b', other: '#5c7080',
}
const WD = ['일', '월', '화', '수', '목', '금', '토']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Operational week calendar with prev/next navigation + per-day detail popover. */
export function DashboardWeekStrip({ activities, careNotes }: { activities: ActEvent[]; careNotes: CareNote[] }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [open, setOpen] = useState<{ idx: number; left: number; top: number } | null>(null)

  const { days, rangeLabel } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const start = new Date(today); start.setDate(today.getDate() - today.getDay() + weekOffset * 7) // week starts Sunday
    const actBy = new Map<string, ActEvent[]>()
    activities.forEach((a) => { if (!a.activity_date) return; const k = a.activity_date.slice(0, 10); actBy.set(k, [...(actBy.get(k) ?? []), a]) })
    const careBy = new Map<string, number>()
    careNotes.forEach((c) => { if (!c.noted_on) return; const k = c.noted_on.slice(0, 10); careBy.set(k, (careBy.get(k) ?? 0) + 1) })
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i)
      const key = ymd(d)
      const acts = (actBy.get(key) ?? []).sort((a, b) => (a.activity_time ?? '99').localeCompare(b.activity_time ?? '99'))
      return { key, date: d, dow: d.getDay(), dayN: d.getDate(), month: d.getMonth() + 1, acts, care: careBy.get(key) ?? 0, isToday: d.getTime() === today.getTime() }
    })
    const rangeLabel = `${days[0].month}.${days[0].dayN} – ${days[6].month}.${days[6].dayN}`
    return { days, rangeLabel }
  }, [activities, careNotes, weekOffset])

  const openDay = open ? days[open.idx] : null
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="py-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>운영 캘린더</CardTitle>
          <div className="flex items-center gap-0.5">
            <button onClick={() => { setOpen(null); setWeekOffset((o) => o - 1) }} title="전주"
              className="w-6 h-6 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill"><ChevronLeft size={14} /></button>
            <button onClick={() => { setOpen(null); setWeekOffset(0) }}
              className={`text-[10.5px] tabular-nums w-[80px] text-center ${weekOffset === 0 ? 'text-accent' : 'text-ink-faint hover:text-ink'}`}>
              {weekOffset === 0 ? '이번 주' : rangeLabel}
            </button>
            <button onClick={() => { setOpen(null); setWeekOffset((o) => o + 1) }} title="다음 주"
              className="w-6 h-6 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill"><ChevronRight size={14} /></button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="grid grid-cols-7 h-full">
          {days.map((d, i) => (
            <button key={d.key} type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setOpen((o) => (o?.idx === i ? null : { idx: i, left: r.left + r.width / 2, top: r.top }))
              }}
              className={`border-r border-line last:border-r-0 p-1.5 flex flex-col gap-1 overflow-hidden text-left transition-colors ${d.isToday ? 'bg-accent-soft/40' : ''} ${open?.idx === i ? 'bg-fill ring-1 ring-inset ring-accent/40' : 'hover:bg-fill'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-medium ${d.dow === 0 ? 'text-danger' : d.dow === 6 ? 'text-accent' : 'text-ink-faint'}`}>{WD[d.dow]}</span>
                <span className={`text-[11px] font-semibold font-data ${d.isToday ? 'bg-accent text-white w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]' : 'text-ink-soft'}`}>{d.dayN}</span>
              </div>
              <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
                {d.acts.slice(0, 2).map((a) => (
                  <span key={a.id} className="flex items-center gap-1 text-[9.5px] text-ink-soft truncate">
                    <span className="w-1 h-1 rounded-full shrink-0" style={{ background: TYPE_DOT[a.type] }} />
                    <span className="truncate">{a.title}</span>
                  </span>
                ))}
                {(d.acts.length > 2 || d.care > 0) && (
                  <span className="text-[8.5px] text-ink-ghost">{d.acts.length > 2 ? `+${d.acts.length - 2} ` : ''}{d.care > 0 ? `· 기록 ${d.care}` : ''}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>

      {/* Day-detail popover (pops above the clicked cell) */}
      {open && openDay && (
        <>
          <div className="fixed inset-0 z-[798]" onClick={() => setOpen(null)} />
          <div className="fixed z-[799] w-[236px] bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] overflow-hidden"
            style={{ left: Math.min(Math.max(open.left - 118, 8), vw - 244), top: open.top - 8, transform: 'translateY(-100%)' }}>
            <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink">{openDay.month}월 {openDay.dayN}일 <span className="text-ink-faint font-normal">({WD[openDay.dow]})</span></p>
                <p className="text-[9.5px] text-ink-faint mt-0.5">일정 {openDay.acts.length}개 · 돌봄 기록 {openDay.care}건</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-ink-faint hover:text-ink shrink-0"><X size={13} /></button>
            </div>
            <div className="max-h-[176px] overflow-y-auto px-1.5 py-1.5 space-y-0.5">
              {openDay.acts.length === 0 ? (
                <p className="text-[11px] text-ink-ghost text-center py-4">등록된 일정이 없습니다</p>
              ) : openDay.acts.map((a) => (
                <div key={a.id} className="flex items-start gap-2 px-2 py-1.5 rounded-[3px] hover:bg-fill">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: TYPE_DOT[a.type] }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11.5px] text-ink font-medium truncate">{a.title}</span>
                    <span className="block text-[9.5px] text-ink-faint">
                      {a.activity_time ? a.activity_time.slice(0, 5) : '시간 미정'} · {ACTIVITY_TYPE_LABELS[a.type] ?? a.type} · {ACTIVITY_STATUS_LABELS[a.status as keyof typeof ACTIVITY_STATUS_LABELS] ?? a.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="px-2 py-2 border-t border-line">
              <Link href="/activities" className="flex items-center justify-center gap-1 w-full px-2 py-1.5 rounded-[3px] bg-accent text-white text-[11px] font-medium hover:bg-accent-hover transition-colors">
                활동 관리에서 편집·삭제 <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
