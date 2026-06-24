'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS } from '@/lib/utils'
import type { Activity, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  initialActivities: Activity[]
  classes: Pick<Class, 'id' | 'name'>[]
  centerId: string
}

const emptyForm = {
  title: '', description: '', activity_date: '', activity_time: '',
  class_id: '', type: 'education' as Activity['type'], status: 'planned' as Activity['status'],
}

export function ActivitiesClient({ initialActivities, classes, centerId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activities, setActivities] = useState(initialActivities)
  const [filterType, setFilterType] = useState<Activity['type'] | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<Activity['status'] | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = activities.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    return true
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.from('activities')
      .insert({
        center_id: centerId,
        title: form.title,
        description: form.description || null,
        activity_date: form.activity_date || null,
        activity_time: form.activity_time || null,
        class_id: form.class_id || null,
        type: form.type,
        status: form.status,
      })
      .select('*, classes(id, name)').single()
    if (error) { setError(error.message); setLoading(false); return }
    setActivities((prev) => [data as Activity, ...prev])
    setModalOpen(false); setForm(emptyForm); setLoading(false)
    router.refresh()
  }

  const handleStatusChange = async (id: string, status: Activity['status']) => {
    const { data, error } = await supabase.from('activities').update({ status }).eq('id', id).select('id')
    if (error || !data || data.length === 0) { alert(`상태 변경 실패: ${error?.message ?? '권한 확인 필요'}`); return }
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, status } : a))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 활동을 삭제하시겠습니까?')) return
    const { error } = await supabase
      .from('activities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setActivities((prev) => prev.filter((a) => a.id !== id))
    router.refresh()
  }

  return (
    <div className="flex-1 p-5 space-y-4 overflow-auto">
      <div className="flex items-center gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer">
          <option value="all">전체 유형</option>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as Activity['type'][]).map((t) => (
            <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer">
          <option value="all">전체 상태</option>
          {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => (
            <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-[11px] text-[#8a93a6]">{filtered.length}개</span>
        <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 활동 추가</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e9edf4]">
                {['제목', '날짜', '시간', '반', '유형', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-[#8a93a6] font-medium uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <CalendarDays size={28} className="mx-auto mb-2 text-[#e6eaf2]" />
                  <p className="text-[12px] text-[#aab2c2]">등록된 활동이 없습니다</p>
                </td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-b border-[#eef2f8] hover:bg-[#f3f6fb] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-0.5 h-5 ${ACTIVITY_TYPE_COLORS[a.type]?.split(' ')[1] ?? 'bg-[#aab2c2]'}`} />
                      <span className="text-[12px] font-medium text-[#1c2740]">{a.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#667085]">{a.activity_date ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-[#667085]">{a.activity_time ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-[#667085]">{(a.classes as Class | undefined)?.name ?? '전체'}</td>
                  <td className="px-4 py-3">
                    <Badge className={ACTIVITY_TYPE_COLORS[a.type]}>{ACTIVITY_TYPE_LABELS[a.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <select value={a.status} onChange={(e) => handleStatusChange(a.id, e.target.value as Activity['status'])}
                      className={`text-[10px] px-2 py-0.5 border-0 cursor-pointer focus:outline-none bg-transparent uppercase tracking-wider ${ACTIVITY_STATUS_COLORS[a.status]}`}>
                      {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => (
                        <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(a.id)} className="text-[#d6dce8] hover:text-[#e5484d] transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError('') }} title="활동 추가" size="md">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="활동명 *" placeholder="예: 미술 치료 프로그램" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="날짜" type="date" value={form.activity_date}
              onChange={(e) => setForm({ ...form, activity_date: e.target.value })} />
            <Input label="시간" type="time" value={form.activity_time}
              onChange={(e) => setForm({ ...form, activity_time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="유형" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Activity['type'] })}>
              {(Object.entries(ACTIVITY_TYPE_LABELS) as [Activity['type'], string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select label="대상 반" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              <option value="">전체</option>
              {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </Select>
          </div>
          <Textarea label="설명" rows={3} placeholder="활동에 대한 설명" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <div className="border border-[#f7caca] bg-[#fdecec] px-3 py-2 text-[11px] text-[#e5484d]">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
