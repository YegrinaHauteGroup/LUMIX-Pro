'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ActType = 'education' | 'therapy' | 'recreation' | 'counseling' | 'other'
interface ActEvent { id: string; title: string; type: ActType; status: string; activity_date: string; activity_time: string | null }
interface CareNote { id: string; child_id: string; content: string; noted_on: string; note_type: string; child_name: string }
interface Props { centerId: string; initialActivities: ActEvent[]; careNotes: CareNote[] }

const TYPE_DOT: Record<string, string> = {
  education: '#58A6FF', therapy: '#bc8cff', recreation: '#3FB950', counseling: '#D29922', other: '#8B949E',
}
const WD = ['일', '월', '화', '수', '목', '금', '토']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function DashboardCalendar({ centerId, initialActivities, careNotes }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [acts, setActs] = useState<ActEvent[]>(initialActivities)
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState<{ id: string | null; title: string; type: ActType; time: string }>({ id: null, title: '', type: 'education', time: '' })
  const [busy, setBusy] = useState(false)

  const actByDay = useMemo(() => {
    const m = new Map<string, ActEvent[]>()
    acts.forEach((a) => { if (!a.activity_date) return; const k = a.activity_date.slice(0, 10); m.set(k, [...(m.get(k) ?? []), a]) })
    return m
  }, [acts])
  const careByDay = useMemo(() => {
    const m = new Map<string, CareNote[]>()
    careNotes.forEach((c) => { if (!c.noted_on) return; const k = c.noted_on.slice(0, 10); m.set(k, [...(m.get(k) ?? []), c]) })
    return m
  }, [careNotes])

  const year = cursor.getFullYear(), month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = ymd(new Date())
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ymd(new Date(year, month, i + 1))),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function openDay(date: string) { setSelected(date); setForm({ id: null, title: '', type: 'education', time: '' }) }

  async function saveActivity() {
    if (!selected || !form.title.trim()) return
    setBusy(true)
    if (form.id) {
      const { error } = await supabase.from('activities').update({ title: form.title.trim(), type: form.type, activity_time: form.time || null }).eq('id', form.id)
      if (!error) setActs((p) => p.map((a) => a.id === form.id ? { ...a, title: form.title.trim(), type: form.type, activity_time: form.time || null } : a))
    } else {
      const { data, error } = await supabase.from('activities')
        .insert({ center_id: centerId, title: form.title.trim(), type: form.type, status: 'planned', activity_date: selected, activity_time: form.time || null })
        .select('id, title, type, status, activity_date, activity_time').single()
      if (!error && data) setActs((p) => [...p, data as ActEvent])
    }
    setForm({ id: null, title: '', type: 'education', time: '' })
    setBusy(false)
    router.refresh()
  }

  async function deleteActivity(id: string) {
    await supabase.from('activities').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setActs((p) => p.filter((a) => a.id !== id))
    if (form.id === id) setForm({ id: null, title: '', type: 'education', time: '' })
    router.refresh()
  }

  const dayActs = selected ? actByDay.get(selected) ?? [] : []
  const dayCare = selected ? careByDay.get(selected) ?? [] : []

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>운영 캘린더</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-[3px] hover:bg-fill text-ink-faint"><ChevronLeft size={15} /></button>
          <span className="text-[12.5px] font-semibold text-ink w-[88px] text-center">{year}년 {month + 1}월</span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-[3px] hover:bg-fill text-ink-faint"><ChevronRight size={15} /></button>
          <button onClick={() => setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })}
            className="ml-1 text-[11px] px-2 h-7 rounded-[3px] border border-line text-ink-soft hover:bg-fill">오늘</button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-line">
          {WD.map((w, i) => (
            <div key={w} className={`text-center text-[10.5px] font-medium py-1.5 ${i === 0 ? 'text-danger' : i === 6 ? 'text-accent' : 'text-ink-faint'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="h-[88px] border-b border-r border-line bg-fill-2/40" />
            const dayN = Number(date.slice(8))
            const dow = i % 7
            const dActs = actByDay.get(date) ?? []
            const dCare = careByDay.get(date) ?? []
            const isToday = date === todayStr
            return (
              <button key={i} onClick={() => openDay(date)}
                className="h-[88px] border-b border-r border-line p-1.5 text-left hover:bg-fill transition-colors flex flex-col gap-1 overflow-hidden">
                <span className={`text-[11px] font-medium font-data ${isToday ? 'bg-accent text-[#0A0C10] w-5 h-5 rounded-full flex items-center justify-center' : dow === 0 ? 'text-danger' : dow === 6 ? 'text-accent' : 'text-ink-soft'}`}>{dayN}</span>
                <div className="flex flex-col gap-0.5 min-h-0">
                  {dActs.slice(0, 2).map((a) => (
                    <span key={a.id} className="flex items-center gap-1 text-[10px] text-ink-soft truncate">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TYPE_DOT[a.type] }} />
                      <span className="truncate">{a.title}</span>
                    </span>
                  ))}
                  {(dActs.length > 2 || dCare.length > 0) && (
                    <span className="text-[9.5px] text-ink-ghost">
                      {dActs.length > 2 ? `+${dActs.length - 2} 활동 ` : ''}{dCare.length > 0 ? `· 기록 ${dCare.length}` : ''}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ?? ''} subtitle="일정 및 기록 · 활동 추가/편집" width={420}>
        {selected && (
          <div className="p-4 space-y-5">
            {/* add / edit form */}
            <div className="space-y-2.5 border border-line rounded-[3px] p-3 bg-fill-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">{form.id ? '활동 편집' : '활동 추가'}</p>
              <Input placeholder="활동 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ActType })}>
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                {form.id && <Button variant="secondary" size="sm" onClick={() => setForm({ id: null, title: '', type: 'education', time: '' })}>취소</Button>}
                <Button size="sm" loading={busy} onClick={saveActivity}><Plus size={12} /> {form.id ? '저장' : '추가'}</Button>
              </div>
            </div>

            {/* activities */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">활동 ({dayActs.length})</p>
              {dayActs.length === 0 ? <p className="text-[11px] text-ink-ghost">등록된 활동이 없습니다.</p> : dayActs.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 px-2.5 py-2 bg-surface border border-line rounded-[3px]">
                  <button className="flex items-center gap-2 min-w-0 text-left" onClick={() => setForm({ id: a.id, title: a.title, type: a.type, time: a.activity_time ?? '' })}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_DOT[a.type] }} />
                    <span className="text-[12px] text-ink truncate">{a.title}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded-[2px] ${ACTIVITY_TYPE_COLORS[a.type]}`}>{ACTIVITY_TYPE_LABELS[a.type]}</span>
                    {a.activity_time && <span className="text-[10px] text-ink-faint">{a.activity_time.slice(0, 5)}</span>}
                  </button>
                  <button onClick={() => deleteActivity(a.id)} className="text-ink-ghost hover:text-danger shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>

            {/* care notes (linked, read-only) */}
            {dayCare.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">연계 기록 ({dayCare.length})</p>
                {dayCare.map((c) => (
                  <div key={c.id} className="px-2.5 py-2 bg-fill-2 border border-line rounded-[3px]">
                    <p className="text-[11.5px] text-ink"><span className="font-medium">{c.child_name}</span> · {c.note_type}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5 leading-snug">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </Card>
  )
}
