'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  CHILD_STATUS_COLORS,
  CHILD_STATUS_LABELS,
  GENDER_LABELS,
  calculateAge,
} from '@/lib/utils'
import type { Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { Filter, Plus, Search, Trash2, UserSquare2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  initialChildren: Child[]
  classes: Pick<Class, 'id' | 'name'>[]
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

export function ChildrenClient({ initialChildren, classes }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [children, setChildren] = useState(initialChildren)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Child['status'] | 'all'>('all')
  const [filterClass, setFilterClass] = useState<string>('all')
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
    setLoading(true)
    setError('')

    const payload = {
      name: form.name,
      birth_date: form.birth_date || null,
      gender: form.gender,
      class_id: form.class_id || null,
      status: form.status,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      notes: form.notes || null,
    }

    const { data, error } = await supabase.from('children').insert(payload).select('*, classes(id, name)').single()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setChildren((prev) => [data as Child, ...prev])
    setModalOpen(false)
    setForm(emptyForm)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 아동을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('children').delete().eq('id', id)
    if (!error) {
      setChildren((prev) => prev.filter((c) => c.id !== id))
    }
  }

  return (
    <div className="flex-1 p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
          <input
            type="text"
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111111] border border-[#1e1e1e] rounded-lg pl-8 pr-3 py-2 text-sm text-[#f5f5f5] placeholder-[#444444] focus:outline-none focus:border-indigo-500 h-9"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#111111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#a0a0a0] focus:outline-none focus:border-indigo-500 h-9 cursor-pointer"
        >
          <option value="all">전체 상태</option>
          <option value="active">재원</option>
          <option value="leave">휴원</option>
          <option value="inactive">퇴원</option>
        </select>

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
        <span className="text-xs text-[#555555]">{filtered.length}명</span>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} />
          아동 등록
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                {['이름', '성별', '나이', '반', '보호자', '연락처', '상태', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs text-[#555555] font-medium px-5 py-3 first:pl-5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-[#444444] py-12 text-sm">
                    <UserSquare2 size={32} className="mx-auto mb-3 text-[#2a2a2a]" />
                    <p>등록된 아동이 없습니다</p>
                  </td>
                </tr>
              ) : (
                filtered.map((child) => (
                  <tr
                    key={child.id}
                    className="border-b border-[#111111] hover:bg-[#141414] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/children/${child.id}`}
                        className="flex items-center gap-2.5 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-600/15 flex items-center justify-center shrink-0">
                          <span className="text-xs text-indigo-400 font-medium">{child.name[0]}</span>
                        </div>
                        <span className="font-medium text-[#e0e0e0] group-hover:text-indigo-400 transition-colors">
                          {child.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[#a0a0a0]">{GENDER_LABELS[child.gender]}</td>
                    <td className="px-5 py-3 text-[#a0a0a0]">
                      {child.birth_date ? `${calculateAge(child.birth_date)}세` : '—'}
                    </td>
                    <td className="px-5 py-3 text-[#a0a0a0]">
                      {(child.classes as Class | undefined)?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-[#a0a0a0]">{child.guardian_name ?? '—'}</td>
                    <td className="px-5 py-3 text-[#a0a0a0]">{child.guardian_phone ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge className={CHILD_STATUS_COLORS[child.status]}>
                        {CHILD_STATUS_LABELS[child.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDelete(child.id)}
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="아동 등록" size="md">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="이름 *"
              placeholder="홍길동"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="생년월일"
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="성별"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Child['gender'] })}
            >
              <option value="male">남</option>
              <option value="female">여</option>
              <option value="other">기타</option>
            </Select>
            <Select
              label="반"
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
            >
              <option value="">반 선택</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="보호자 이름"
              placeholder="김보호"
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
            />
            <Input
              label="보호자 연락처"
              placeholder="010-0000-0000"
              value={form.guardian_phone}
              onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
            />
          </div>
          <Select
            label="상태"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Child['status'] })}
          >
            <option value="active">재원</option>
            <option value="leave">휴원</option>
            <option value="inactive">퇴원</option>
          </Select>

          {error && (
            <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={loading}>
              등록
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
