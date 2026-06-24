'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from '@/lib/utils'
import type { AttendanceRecord, Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, Circle, Clock, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

type AttStatus = AttendanceRecord['status']

interface ChildRow extends Pick<Child, 'id' | 'name' | 'class_id'> {
  classes: Pick<Class, 'id' | 'name'> | null
}

interface Props {
  children: ChildRow[]
  classes: Pick<Class, 'id' | 'name'>[]
  today: string
  centerId: string
}

const STATUS_ICONS: Record<AttStatus, React.ReactNode> = {
  present: <CheckCircle2 size={12} className="text-emerald-500" />,
  absent: <Circle size={12} className="text-red-500" />,
  late: <Clock size={12} className="text-yellow-500" />,
  leave: <LogOut size={12} className="text-orange-500" />,
}

export function AttendanceClient({ children, classes, today, centerId }: Props) {
  const supabase = createClient()
  const [checkDate, setCheckDate] = useState(today)
  const [filterClass, setFilterClass] = useState('all')
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const filtered = children.filter((c) => filterClass === 'all' || c.class_id === filterClass)

  useEffect(() => { loadAttendance() }, [checkDate])

  const loadAttendance = async () => {
    setLoadingData(true)
    const { data } = await supabase.from('attendance').select('child_id, status').eq('check_date', checkDate)
    const map: Record<string, AttStatus> = {}
    ;(data ?? []).forEach((r: { child_id: string; status: AttStatus }) => { map[r.child_id] = r.status })
    setAttendance(map)
    setLoadingData(false)
  }

  const handleStatus = async (childId: string, status: AttStatus) => {
    setSaving(childId)
    if (attendance[childId] === status) {
      const { error } = await supabase.from('attendance').delete().eq('child_id', childId).eq('check_date', checkDate)
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(null); return }
      setAttendance((prev) => { const n = { ...prev }; delete n[childId]; return n })
    } else {
      const { error } = await supabase.from('attendance').upsert(
        { center_id: centerId, child_id: childId, check_date: checkDate, status },
        { onConflict: 'child_id,check_date' }
      )
      if (error) { alert(`저장 실패: ${error.message}`); setSaving(null); return }
      setAttendance((prev) => ({ ...prev, [childId]: status }))
    }
    setSaving(null)
  }

  const handleBulkPresent = async () => {
    const updates = filtered.map((c) => ({ center_id: centerId, child_id: c.id, check_date: checkDate, status: 'present' as AttStatus }))
    const { error } = await supabase.from('attendance').upsert(updates, { onConflict: 'child_id,check_date' })
    if (error) { alert(`저장 실패: ${error.message}`); return }
    const n = { ...attendance }
    filtered.forEach((c) => { n[c.id] = 'present' })
    setAttendance(n)
  }

  const counts = {
    present: Object.values(attendance).filter((v) => v === 'present').length,
    absent: Object.values(attendance).filter((v) => v === 'absent').length,
    late: Object.values(attendance).filter((v) => v === 'late').length,
    leave: Object.values(attendance).filter((v) => v === 'leave').length,
  }

  return (
    <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-6 overflow-auto">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#0e1726] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm" />
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer">
          <option value="all">전체 반</option>
          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
        </select>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleBulkPresent}>
          <CheckCircle2 size={12} /> 전체 출석
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: '출석', value: counts.present, color: 'text-emerald-500' },
          { label: '결석', value: counts.absent, color: 'text-red-500' },
          { label: '지각', value: counts.late, color: 'text-yellow-500' },
          { label: '조퇴', value: counts.leave, color: 'text-orange-500' },
        ].map((s) => (
          <div key={s.label} className="bg-[#ffffff] border border-[#e6eaf2] px-5 py-4">
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{checkDate} 출석 현황</CardTitle>
            <span className="text-[10px] text-[#8a93a6]">{filtered.length}명</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="text-center text-[12px] text-[#aab2c2] py-10">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[12px] text-[#aab2c2] py-10">재원 아동이 없습니다</p>
          ) : (
            <div>
              {filtered.map((child) => {
                const status = attendance[child.id]
                return (
                  <div key={child.id} className="flex items-center gap-4 px-6 py-4 border-b border-[#eef2f8] hover:bg-[#f3f6fb] transition-colors last:border-0">
                    <div className="w-6 h-6 bg-[#f1f4f9] border border-[#e6eaf2] flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-[#7a8499]">{child.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#1c2740] font-medium">{child.name}</p>
                      <p className="text-[10px] text-[#8a93a6]">{(child.classes as Class | null)?.name ?? '반 미배정'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(Object.keys(ATTENDANCE_STATUS_LABELS) as AttStatus[]).map((s) => (
                        <button key={s} onClick={() => handleStatus(child.id, s)} disabled={saving === child.id}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors rounded-sm ${
                            status === s ? ATTENDANCE_STATUS_COLORS[s] : 'text-[#aab2c2] hover:text-[#667085] hover:bg-[#f1f4f9]'
                          }`}>
                          {STATUS_ICONS[s]}{ATTENDANCE_STATUS_LABELS[s]}
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
