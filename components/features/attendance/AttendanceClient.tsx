'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, Circle, Clock, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

// canonical attendances enum
type AttStatus = 'present' | 'absent' | 'late' | 'early_leave'
const STATUS_LABELS: Record<AttStatus, string> = { present: '출석', absent: '결석', late: '지각', early_leave: '조퇴' }
const STATUS_COLORS: Record<AttStatus, string> = {
  present: 'text-success bg-success-soft border border-[color:var(--color-success-soft)]',
  absent: 'text-danger bg-danger-soft border border-[color:var(--color-danger-soft)]',
  late: 'text-warn bg-warn-soft border border-[color:var(--color-warn-soft)]',
  early_leave: 'text-[#58A6FF] bg-[rgba(88,166,255,0.14)] border border-[rgba(88,166,255,0.2)]',
}
const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 size={12} className="text-emerald-500" />,
  absent: <Circle size={12} className="text-rose-500" />,
  late: <Clock size={12} className="text-amber-500" />,
  early_leave: <LogOut size={12} className="text-orange-500" />,
}
const ORDER: AttStatus[] = ['present', 'late', 'early_leave', 'absent']

interface ChildRow extends Pick<Child, 'id' | 'name' | 'class_id'> {
  classes: Pick<Class, 'id' | 'name'> | null
}
interface Props {
  children: ChildRow[]
  classes: Pick<Class, 'id' | 'name'>[]
  today: string
  centerId: string
}

export function AttendanceClient({ children, classes, today, centerId }: Props) {
  const supabase = createClient()
  const [checkDate, setCheckDate] = useState(today)
  const [filterClass, setFilterClass] = useState('all')
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const filtered = children.filter((c) => filterClass === 'all' || c.class_id === filterClass)

  useEffect(() => { loadAttendance() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [checkDate])

  const loadAttendance = async () => {
    setLoadingData(true); setErr(null)
    const { data, error } = await supabase.from('attendances')
      .select('child_id, status').eq('attendance_date', checkDate).is('deleted_at', null)
    if (error) setErr(error.message)
    const map: Record<string, AttStatus> = {}
    ;(data ?? []).forEach((r: { child_id: string; status: AttStatus }) => { map[r.child_id] = r.status })
    setAttendance(map)
    setLoadingData(false)
  }

  const handleStatus = async (childId: string, status: AttStatus) => {
    setSaving(childId); setErr(null)
    if (attendance[childId] === status) {
      const { error } = await supabase.from('attendances').delete().eq('child_id', childId).eq('attendance_date', checkDate)
      if (error) { setErr(`저장 실패: ${error.message}`); setSaving(null); return }
      setAttendance((prev) => { const n = { ...prev }; delete n[childId]; return n })
    } else {
      const { error } = await supabase.from('attendances').upsert(
        { center_id: centerId, child_id: childId, attendance_date: checkDate, status, transport_method: 'walk' },
        { onConflict: 'child_id,attendance_date' },
      )
      if (error) { setErr(`저장 실패: ${error.message}`); setSaving(null); return }
      setAttendance((prev) => ({ ...prev, [childId]: status }))
    }
    setSaving(null)
  }

  const handleBulkPresent = async () => {
    setErr(null)
    const updates = filtered.map((c) => ({ center_id: centerId, child_id: c.id, attendance_date: checkDate, status: 'present' as AttStatus, transport_method: 'walk' }))
    const { error } = await supabase.from('attendances').upsert(updates, { onConflict: 'child_id,attendance_date' })
    if (error) { setErr(`저장 실패: ${error.message}`); return }
    const n = { ...attendance }
    filtered.forEach((c) => { n[c.id] = 'present' })
    setAttendance(n)
  }

  const counts = {
    present: Object.values(attendance).filter((v) => v === 'present').length,
    late: Object.values(attendance).filter((v) => v === 'late').length,
    early_leave: Object.values(attendance).filter((v) => v === 'early_leave').length,
    absent: Object.values(attendance).filter((v) => v === 'absent').length,
  }
  const marked = counts.present + counts.late + counts.early_leave + counts.absent
  const rate = filtered.length ? Math.round(((counts.present + counts.late) / filtered.length) * 100) : 0

  return (
    <div className="flex-1 p-5 w-full space-y-4 overflow-auto">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
          className="bg-surface border border-line px-3 text-[12px] text-ink focus:outline-none focus:border-accent h-8 rounded-[3px]" />
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="bg-surface border border-line px-3 text-[12px] text-ink-soft focus:outline-none focus:border-accent h-8 rounded-[3px] cursor-pointer">
          <option value="all">전체 반</option>
          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
        </select>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleBulkPresent}>
          <CheckCircle2 size={12} /> 전체 출석 처리
        </Button>
      </div>

      {err && <div className="px-3 py-2.5 text-[12px] rounded-[3px] text-danger bg-danger-soft border border-[color:var(--color-danger-soft)]">{err}</div>}

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '출석', value: counts.present, color: 'text-emerald-600' },
          { label: '지각', value: counts.late, color: 'text-amber-600' },
          { label: '조퇴', value: counts.early_leave, color: 'text-orange-600' },
          { label: '결석', value: counts.absent, color: 'text-rose-600' },
          { label: '출석률', value: `${rate}%`, color: 'text-accent' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] px-5 py-4">
            <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-1.5">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{checkDate} 출석 현황</CardTitle>
            <span className="text-[10px] text-ink-faint">{marked} / {filtered.length}명 기록</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="text-center text-[12px] text-ink-ghost py-10">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[12px] text-ink-ghost py-10">재원 아동이 없습니다</p>
          ) : (
            <div>
              {filtered.map((child) => {
                const status = attendance[child.id]
                return (
                  <div key={child.id} className="flex items-center gap-4 px-6 py-3 border-b border-line hover:bg-fill-2 transition-colors last:border-0">
                    <div className="w-7 h-7 bg-fill border border-line rounded-[3px] flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-ink-faint">{child.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-ink font-medium">{child.name}</p>
                      <p className="text-[10px] text-ink-faint">{child.classes?.name ?? '반 미배정'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {ORDER.map((s) => (
                        <button key={s} onClick={() => handleStatus(child.id, s)} disabled={saving === child.id}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors rounded-[3px] ${
                            status === s ? STATUS_COLORS[s] : 'text-ink-ghost hover:text-ink-soft hover:bg-fill'
                          }`}>
                          {STATUS_ICONS[s]}{STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
