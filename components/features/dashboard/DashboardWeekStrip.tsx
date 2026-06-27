'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'

type ActType = 'education' | 'therapy' | 'recreation' | 'counseling' | 'other'
interface ActEvent { id: string; title: string; type: ActType; status: string; activity_date: string; activity_time: string | null }
interface CareNote { id: string; child_id: string; content: string; noted_on: string; note_type: string; child_name: string }

const TYPE_DOT: Record<string, string> = {
  education: '#137cbd', therapy: '#8b5cf6', recreation: '#0f9960', counseling: '#d9822b', other: '#5c7080',
}
const WD = ['일', '월', '화', '수', '목', '금', '토']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Operational 7-day calendar: today + next 6 days (week granularity). */
export function DashboardWeekStrip({ activities, careNotes }: { activities: ActEvent[]; careNotes: CareNote[] }) {
  const days = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const actBy = new Map<string, ActEvent[]>()
    activities.forEach((a) => { if (!a.activity_date) return; const k = a.activity_date.slice(0, 10); actBy.set(k, [...(actBy.get(k) ?? []), a]) })
    const careBy = new Map<string, number>()
    careNotes.forEach((c) => { if (!c.noted_on) return; const k = c.noted_on.slice(0, 10); careBy.set(k, (careBy.get(k) ?? 0) + 1) })
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i)
      const key = ymd(d)
      return { key, date: d, dow: d.getDay(), dayN: d.getDate(), acts: actBy.get(key) ?? [], care: careBy.get(key) ?? 0, isToday: i === 0 }
    })
  }, [activities, careNotes])

  const todayStr = `${days[0]?.date.getMonth() + 1}월 ${days[0]?.dayN}일`

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="py-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>운영 캘린더 · 이번 주</CardTitle>
          <Link href="/activities" className="text-[10px] text-ink-faint hover:text-accent flex items-center gap-1 uppercase tracking-widest">
            {todayStr} <ArrowRight size={10} />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <div className="grid grid-cols-7 h-full">
          {days.map((d) => (
            <Link key={d.key} href="/activities"
              className={`border-r border-line last:border-r-0 p-1.5 flex flex-col gap-1 overflow-hidden hover:bg-fill transition-colors ${d.isToday ? 'bg-accent-soft/40' : ''}`}>
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
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
