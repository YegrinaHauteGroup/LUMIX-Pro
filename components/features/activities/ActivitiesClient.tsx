'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  ACTIVITY_STATUS_COLORS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_TYPE_LABELS,
} from '@/lib/utils'
import type { Activity, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  initialActivities: Activity[]
  classes: Pick<Class, 'id' | 'name'>[]
}

const emptyForm = {
  title: '',
  description: '',
  activity_date: '',
  activity_time: '',
  class_id: '',
  type: 'education' as Activity['type'],
  status: 'planned' as Activity['status'],
}

export function ActivitiesClient({ initialActivities, classes }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [activities, setActivities] = useState(initialActivities)
  const [modalOpen, setModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<Activity['type'] | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<Activity['status'] | 'all'>('all')
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
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('activities')
      .insert({
        title: form.title,
        description: form.description || null,
        activity_date: form.activity_date || null,
        activity_time: form.activity_time || null,
        class_id: form.class_id || null,
        type: form.type,
        status: form.status,
      })
      .select('*, classes(id, name)')
      .single()

    if (error) { setError(error.message); setLoading(false); return }
    setActivities((prev) => [data as Activity, ...prev])
    setModalOpen(false)
    setForm(emptyForm)
    setLoading(false)
    router.refresh()
  }

  const handleStatusChange = async (id: string, status: Activity['status']) => {
    const { error } = await supabase.from('activities').update({ status }).eq('id', id)
    if (!error) {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 활동을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (!error) setActivities((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="flex-1 p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="bg-[#111111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#a0a0a0] focus:outline-none focus:border-indigo-500 h-9 cursor-pointer"
        >
          <option value="all">전체 유형</option>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as Activity['type'][]).map((t) => (
            <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#111111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#a0a0a0] focus:outline-none focus:border-indigo-500 h-9 cursor-pointer"
        >
          <option value="all">전체 상태</option>
          {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => (
            <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-[#555555]">{filtered.length}개</span>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} />
          활동 추가
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                {['제목', '날짜', '시간', '반', '유형', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-xs text-[#555555] font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[#444444] py-12 text-sm">
                    <CalendarDays size={32} className="mx-auto mb-3 text-[#2a2a2a]" />
                    <p>등록된 활동이 없습니다</p>
                  </td>
                </tr>
              ) : (
                filtered.map((activity) => (
                  <tr key={activity.id} className="border-b border-[#111111] hover:bg-[#141414] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-6 rounded-full ${ACTIVITY_TYPE_COLORS[activity.type]?.split(' ')[1]}`} />
                        <span className="font-medium text-[#e0e0e0]">{activity.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#a0a0a0]">{activity.activity_date ?? '—'}</td>
                    <td className="px-5 py-3 text-[#a0a0a0]">{activity.activity_time ?? '—'}</td>
                    <td className="px-5 py-3 text-[#a0a0a0]">
                      {(activity.classes as Class | undefined)?.name ?? '전체'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={ACTIVITY_TYPE_COLORS[activity.type]}>
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={activity.status}
                        onChange={(e) => handleStatusChange(activity.id, e.target.value as Activity['status'])}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${ACTIVITY_STATUS_COLORS[activity.status]}`}
                      >
                        {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => (
                          <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="text-[#333333] hover:text-red-400 transition-colors p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="활동 추가" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="활동명 *"
            placeholder="예: 미술 치료 프로그램"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="날짜"
              type="date"
              value={form.activity_date}
              onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
            />
            <Input
              label="시간"
              type="time"
              value={form.activity_time}
              onChange={(e) => setForm({ ...form, activity_time: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="유형"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Activity['type'] })}
            >
              {(Object.entries(ACTIVITY_TYPE_LABELS) as [Activity['type'], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Select
              label="대상 반"
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
            >
              <option value="">전체</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </Select>
          </div>
          <Textarea
            label="설명"
            rows={3}
            placeholder="활동에 대한 설명"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
