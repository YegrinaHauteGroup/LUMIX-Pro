'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from '@/lib/utils'
import type { AttendanceRecord, Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, Circle, Clock, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

type AttStatus = AttendanceRecord['status']

interface ChildWithClass extends Pick<Child, 'id' | 'name' | 'class_id'> {
  classes: Pick<Class, 'id' | 'name'> | null
}

interface Props {
  children: ChildWithClass[]
  classes: Pick<Class, 'id' | 'name'>[]
  today: string
}

const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 size={14} className="text-emerald-400" />,
  absent: <Circle size={14} className="text-red-400" />,
  late: <Clock size={14} className="text-yellow-400" />,
  leave: <LogOut size={14} className="text-orange-400" />,
}

export function AttendanceClient({ children, classes, today }: Props) {
  const supabase = createClient()

  const [checkDate, setCheckDate] = useState(today)
  const [filterClass, setFilterClass] = useState<string>('all')
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const filtered = children.filter((c) =>
    filterClass === 'all' || c.class_id === filterClass
  )

  const present = Object.values(attendance).filter((v) => v === 'present').length
  const absent = Object.values(attendance).filter((v) => v === 'absent').length
  const late = Object.values(attendance).filter((v) => v === 'late').length
  const leave = Object.values(attendance).filter((v) => v === 'leave').length

  useEffect(() => {
    loadAttendance()
  }, [checkDate])

  const loadAttendance = async () => {
    setLoadingData(true)
    const { data } = await supabase
      .from('attendance')
      .select('child_id, status')
      .eq('check_date', checkDate)

    const map: Record<string, AttStatus> = {}
    ;(data ?? []).forEach((r: { child_id: string; status: AttStatus }) => {
      map[r.child_id] = r.status
    })
    setAttendance(map)
    setLoadingData(false)
  }

  const handleStatus = async (childId: string, status: AttStatus) => {
    setSaving(childId)
    const current = attendance[childId]

    if (current === status) {
      await supabase.from('attendance').delete()
        .eq('child_id', childId)
        .eq('check_date', checkDate)
      setAttendance((prev) => { const next = { ...prev }; delete next[childId]; return next })
    } else {
      await supabase.from('attendance').upsert(
        { child_id: childId, check_date: checkDate, status },
        { onConflict: 'child_id,check_date' }
      )
      setAttendance((prev) => ({ ...prev, [childId]: status }))
    }

    setSaving(null)
  }

  const handleBulkPresent = async () => {
    const updates = filtered.map((c) => ({
      child_id: c.id,
      check_date: checkDate,
      status: 'present' as AttStatus,
    }))
    await supabase.from('attendance').upsert(updates, { onConflict: 'child_id,check_date' })
    const newAtt = { ...attendance }
    filtered.forEach((c) => { newAtt[c.id] = 'present' })
    setAttendance(newAtt)
  }

  return (
    <div className="flex-1 p-6 space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={checkDate}
          onChange={(e) => setCheckDate(e.target.value)}
          className="bg-[#111111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-indigo-500 h-9"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#111111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#a0a0a0] focus:outline-none focus:border-indigo-500 h-9 cursor-pointer"
        >
          <option value="all">전체 반</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <Button variant="secondary" onClick={handleBulkPresent} size="sm">
          <CheckCircle2 size={13} />
          전체 출석 처리
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '출석', value: present, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: '결석', value: absent, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: '지각', value: late, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
          { label: '조퇴', value: leave, color: 'text-orange-400', bg: 'bg-orange-400/10' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-lg px-4 py-3 border border-[#1e1e1e]`}>
            <p className="text-xs text-[#666666]">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Attendance table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{checkDate} 출석 현황</CardTitle>
            <span className="text-xs text-[#555555]">{filtered.length}명</span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="text-center py-8 text-sm text-[#444444]">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#444444]">재원 아동이 없습니다</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((child) => {
                const status = attendance[child.id]
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-[#141414] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-600/15 flex items-center justify-center shrink-0">
                      <span className="text-xs text-indigo-400 font-medium">{child.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#e0e0e0] font-medium">{child.name}</p>
                      <p className="text-xs text-[#555555]">
                        {(child.classes as Class | null)?.name ?? '반 미배정'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatus(child.id, s)}
                          disabled={saving === child.id}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            status === s
                              ? ATTENDANCE_STATUS_COLORS[s]
                              : 'text-[#444444] hover:text-[#666666] hover:bg-[#1a1a1a]'
                          }`}
                        >
                          {STATUS_ICONS[s]}
                          {ATTENDANCE_STATUS_LABELS[s]}
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
