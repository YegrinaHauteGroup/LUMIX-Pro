'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Drawer } from '@/components/ui/Drawer'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS, GENDER_LABELS, calculateAge } from '@/lib/utils'
import type { Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { ExternalLink, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
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
  // drawer: add (editId === 'new') / edit (editId === child.id) / closed (null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = children.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterClass !== 'all' && c.class_id !== filterClass) return false
    return true
  })

  function openAdd() { setForm(emptyForm); setError(''); setEditId('new') }
  function openEdit(c: Child) {
    setError('')
    setForm({
      name: c.name, birth_date: c.birth_date ?? '', gender: c.gender,
      class_id: c.class_id ?? '', status: c.status,
      guardian_name: c.guardian_name ?? '', guardian_phone: c.guardian_phone ?? '', notes: c.notes ?? '',
    })
    setEditId(c.id)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true); setError('')
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
    if (editId && editId !== 'new') {
      const { data, error } = await supabase.from('children').update(payload).eq('id', editId)
        .select('*, classes(id, name)').single()
      if (error) { setError(error.message); setLoading(false); return }
      setChildren((prev) => prev.map((c) => c.id === editId ? (data as Child) : c))
    } else {
      const { data, error } = await supabase.from('children').insert({ center_id: centerId, ...payload })
        .select('*, classes(id, name)').single()
      if (error) { setError(error.message); setLoading(false); return }
      setChildren((prev) => [data as Child, ...prev])
    }
    setEditId(null); setForm(emptyForm); setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 아동을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('children').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setChildren((prev) => prev.filter((c) => c.id !== id))
    if (editId === id) setEditId(null)
    router.refresh()
  }

  const editing = editId && editId !== 'new' ? children.find((c) => c.id === editId) ?? null : null

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            placeholder="이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 bg-fill-2 border border-line pl-8 pr-3 py-1.5 text-[12px] text-ink placeholder-ink-ghost focus:outline-none focus:border-accent h-8 rounded-[3px]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-fill-2 border border-line px-3 py-1.5 text-[12px] text-ink-soft focus:outline-none focus:border-accent h-8 rounded-[3px] cursor-pointer"
        >
          <option value="all">전체 상태</option>
          <option value="active">재원</option>
          <option value="leave">휴원</option>
          <option value="inactive">퇴원</option>
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-fill-2 border border-line px-3 py-1.5 text-[12px] text-ink-soft focus:outline-none focus:border-accent h-8 rounded-[3px] cursor-pointer"
        >
          <option value="all">전체 반</option>
          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-[11px] text-ink-faint font-data">{filtered.length}명</span>
        <Button onClick={openAdd} size="sm"><Plus size={12} /> 아동 등록</Button>
      </div>

      {/* Table */}
      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto min-h-0 flex-1">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-fill-2">
                {['이름', '성별', '나이', '반', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-ink-faint font-semibold uppercase tracking-widest px-3.5 py-2.5 bg-fill-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Users size={28} className="mx-auto mb-2 text-line" />
                    <p className="text-[12px] text-ink-ghost">등록된 아동이 없습니다</p>
                  </td>
                </tr>
              ) : filtered.map((child) => (
                <tr key={child.id} className="border-b border-line last:border-0 hover:bg-fill transition-colors">
                  <td className="px-3.5 py-2.5">
                    <button onClick={() => openEdit(child)} className="flex items-center gap-2.5 group text-left">
                      <div className="w-6 h-6 bg-fill-2 border border-line flex items-center justify-center shrink-0 rounded-[2px]">
                        <span className="text-[10px] text-ink-soft">{child.name[0]}</span>
                      </div>
                      <span className="text-[12px] font-medium text-ink group-hover:text-accent transition-colors">
                        {child.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-3.5 py-2.5 text-[12px] text-ink-soft">{GENDER_LABELS[child.gender]}</td>
                  <td className="px-3.5 py-2.5 text-[12px] text-ink-soft font-data">
                    {child.birth_date ? `${calculateAge(child.birth_date)}세` : '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-[12px] text-ink-soft">
                    {(child.classes as Class | undefined)?.name ?? '—'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge className={CHILD_STATUS_COLORS[child.status]}>{CHILD_STATUS_LABELS[child.status]}</Badge>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      <Link href={`/children/${child.id}`} title="상세 보기" className="text-ink-ghost hover:text-accent transition-colors p-1">
                        <ExternalLink size={13} />
                      </Link>
                      <button onClick={() => openEdit(child)} title="편집" className="text-ink-ghost hover:text-ink transition-colors p-1">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(child.id)} title="삭제" className="text-ink-ghost hover:text-danger transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit drawer (right side, Foundry-style) */}
      <Drawer
        open={editId !== null}
        onClose={() => { setEditId(null); setError('') }}
        title={editId === 'new' ? '아동 등록' : '아동 정보 편집'}
        subtitle={editing ? `${GENDER_LABELS[editing.gender]} · ${editing.birth_date ? `${calculateAge(editing.birth_date)}세` : '나이 미상'}` : '신규 아동 등록'}
        width={420}
        footer={
          <div className="flex items-center justify-between">
            {editing
              ? <Button variant="danger" size="sm" onClick={() => handleDelete(editing.id)}><Trash2 size={12} /> 삭제</Button>
              : <span />}
            <Button size="sm" form="child-form" type="submit" loading={loading}>{editId === 'new' ? '등록' : '저장'}</Button>
          </div>
        }
      >
        <form id="child-form" onSubmit={handleSave} className="p-4 space-y-3">
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
          <Textarea label="메모" rows={3} placeholder="특이사항" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <div className="border border-[color:var(--color-danger-soft)] bg-danger-soft px-3 py-2 text-[11px] text-danger rounded-[3px]">{error}</div>}

          {/* Read-only ontology detail — surfaced in the right drawer */}
          {editing && (() => {
            const items = [
              ['학교', editing.school_name], ['학년', editing.grade_level],
              ['학습 수준', editing.learning_level], ['등록 유형', editing.enrollment_type === 'beneficiary' ? '수혜' : editing.enrollment_type === 'general' ? '일반' : null],
              ['국적', editing.nationality], ['모국어', editing.native_language],
              ['혈액형', editing.blood_type], ['키', editing.height_cm ? `${editing.height_cm}cm` : null],
              ['몸무게', editing.weight_kg ? `${editing.weight_kg}kg` : null], ['비상연락', editing.emergency_contact_phone],
            ].filter(([, v]) => v) as [string, string][]
            if (items.length === 0 && !editing.characteristics && !editing.dietary_notes) return null
            return (
              <div className="pt-3 mt-1 border-t border-line space-y-2">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">상세 정보 · 읽기 전용</p>
                {items.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(([k, v]) => (
                      <div key={k} className="bg-fill-2 border border-line rounded-[2px] px-2 py-1.5 min-w-0">
                        <p className="text-[9px] text-ink-faint uppercase tracking-wide">{k}</p>
                        <p className="text-[11px] text-ink font-data truncate">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
                {editing.characteristics && (
                  <div><p className="text-[9px] text-ink-faint uppercase tracking-wide mb-0.5">특성</p><p className="text-[11px] text-ink-soft leading-snug">{editing.characteristics}</p></div>
                )}
                {editing.dietary_notes && (
                  <div><p className="text-[9px] text-ink-faint uppercase tracking-wide mb-0.5">식이 정보</p><p className="text-[11px] text-ink-soft leading-snug">{editing.dietary_notes}</p></div>
                )}
              </div>
            )
          })()}

          {editing && (
            <Link href={`/children/${editing.id}`} className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-hover">
              <ExternalLink size={12} /> 전체 프로필·관계망 상세 보기
            </Link>
          )}
        </form>
      </Drawer>
    </div>
  )
}
