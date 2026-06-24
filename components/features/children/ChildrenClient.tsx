'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS, GENDER_LABELS, calculateAge } from '@/lib/utils'
import type { Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { Plus, Search, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  initialChildren: Child[]
  classes: Pick<Class, 'id' | 'name'>[]
  centerId: string
}

const emptyForm = {
  name: '',
  birth_date: '',
  gender: 'male' as Child['gender'],
  class_id: '',
  status: 'active' as Child['status'],
  guardian_name: '',
  guardian_phone: '',
  notes: '',
}

export function ChildrenClient({ initialChildren, classes, centerId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [children, setChildren] = useState(initialChildren)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Child['status'] | 'all'>('all')
  const [filterClass, setFilterClass] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = children.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterClass !== 'all' && c.class_id !== filterClass) return false
    return true
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('children')
      .insert({
        center_id: centerId,
        name: form.name,
        birth_date: form.birth_date || null,
        gender: form.gender,
        class_id: form.class_id || null,
        status: form.status,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        notes: form.notes || null,
      })
      .select('*, classes(id, name)')
      .single()

    if (error) { setError(error.message); setLoading(false); return }
    setChildren((prev) => [data as Child, ...prev])
    setModalOpen(false)
    setForm(emptyForm)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 아동을 삭제하시겠습니까?')) return
    const { error } = await supabase
      .from('children')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setChildren((prev) => prev.filter((c) => c.id !== id))
    router.refresh()
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a93a6]" />
          <input
            type="text"
            placeholder="이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 bg-[#ffffff] border border-[#e6eaf2] pl-8 pr-3 py-1.5 text-[12px] text-[#0e1726] placeholder-[#aab2c2] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 py-1.5 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer"
        >
          <option value="all">전체 상태</option>
          <option value="active">재원</option>
          <option value="leave">휴원</option>
          <option value="inactive">퇴원</option>
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-[#ffffff] border border-[#e6eaf2] px-3 py-1.5 text-[12px] text-[#5a6678] focus:outline-none focus:border-[#5a63f2] h-8 rounded-sm cursor-pointer"
        >
          <option value="all">전체 반</option>
          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-[11px] text-[#8a93a6]">{filtered.length}명</span>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus size={12} /> 아동 등록
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e9edf4]">
                {['이름', '성별', '나이', '반', '보호자', '연락처', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-[#8a93a6] font-medium uppercase tracking-widest px-6 py-4 first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Users size={28} className="mx-auto mb-2 text-[#e6eaf2]" />
                    <p className="text-[12px] text-[#aab2c2]">등록된 아동이 없습니다</p>
                  </td>
                </tr>
              ) : filtered.map((child) => (
                <tr key={child.id} className="border-b border-[#eef2f8] hover:bg-[#f3f6fb] transition-colors">
                  <td className="px-6 py-4 first:pl-5">
                    <Link href={`/children/${child.id}`} className="flex items-center gap-2.5 group">
                      <div className="w-6 h-6 bg-[#f1f4f9] border border-[#e1e6ef] flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-[#5a6678]">{child.name[0]}</span>
                      </div>
                      <span className="text-[12px] font-medium text-[#1c2740] group-hover:text-[#0e1726] transition-colors">
                        {child.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#667085]">{GENDER_LABELS[child.gender]}</td>
                  <td className="px-6 py-4 text-[12px] text-[#667085]">
                    {child.birth_date ? `${calculateAge(child.birth_date)}세` : '—'}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#667085]">
                    {(child.classes as Class | undefined)?.name ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#667085]">{child.guardian_name ?? '—'}</td>
                  <td className="px-6 py-4 text-[12px] text-[#667085]">{child.guardian_phone ?? '—'}</td>
                  <td className="px-6 py-4">
                    <Badge className={CHILD_STATUS_COLORS[child.status]}>{CHILD_STATUS_LABELS[child.status]}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(child.id)} className="text-[#d6dce8] hover:text-[#e5484d] transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError('') }} title="아동 등록">
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="이름 *" placeholder="홍길동" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="생년월일" type="date" value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="성별" value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Child['gender'] })}>
              <option value="male">남</option>
              <option value="female">여</option>
              <option value="other">기타</option>
            </Select>
            <Select label="반" value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              <option value="">반 선택</option>
              {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="보호자 이름" placeholder="김보호" value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            <Input label="보호자 연락처" placeholder="010-0000-0000" value={form.guardian_phone}
              onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
          </div>
          <Select label="상태" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Child['status'] })}>
            <option value="active">재원</option>
            <option value="leave">휴원</option>
            <option value="inactive">퇴원</option>
          </Select>
          {error && <div className="border border-[#f7caca] bg-[#fdecec] px-3 py-2 text-[11px] text-[#e5484d]">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>등록</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
