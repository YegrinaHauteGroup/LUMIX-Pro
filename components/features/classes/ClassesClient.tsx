'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS } from '@/lib/utils'
import type { Child } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { BookOpen, Plus, Settings2, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type ChildLite = Pick<Child, 'id' | 'name' | 'gender' | 'status'>
interface ClassItem {
  id: string; name: string; description: string | null; capacity: number | null
  age_group: string | null; homeroom_staff_id: string | null; created_at: string
  children: ChildLite[]
}
interface Staff { id: string; name: string; role: string }
interface AllChild { id: string; name: string; class_id: string | null; status: string }
interface Props { initialClasses: ClassItem[]; staff: Staff[]; allChildren: AllChild[]; centerId: string }

const emptyForm = { name: '', age_group: '', description: '', capacity: '' }

export function ClassesClient({ initialClasses, staff, allChildren, centerId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [classes, setClasses] = useState(initialClasses)
  const [children, setChildren] = useState(allChildren)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ---- drawer (edit / manage a class) ----
  const [editId, setEditId] = useState<string | null>(null)
  const editing = classes.find((c) => c.id === editId) ?? null
  const [edit, setEdit] = useState({ name: '', age_group: '', capacity: '', description: '', homeroom_staff_id: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [drawerMsg, setDrawerMsg] = useState('')

  const staffName = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  function openDrawer(c: ClassItem) {
    setEditId(c.id); setDrawerMsg('')
    setEdit({
      name: c.name, age_group: c.age_group ?? '', capacity: c.capacity != null ? String(c.capacity) : '',
      description: c.description ?? '', homeroom_staff_id: c.homeroom_staff_id ?? '',
    })
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.from('classes')
      .insert({ center_id: centerId, name: form.name, age_group: form.age_group || null, description: form.description || null, capacity: form.capacity ? Number(form.capacity) : null })
      .select('*, children(id, name, gender, status)').single()
    if (error) { setError(error.message); setLoading(false); return }
    setClasses((prev) => [...prev, data as ClassItem])
    setModalOpen(false); setForm(emptyForm); setLoading(false)
    router.refresh()
  }

  async function saveEdit() {
    if (!editing) return
    setSavingEdit(true); setDrawerMsg('')
    const { error } = await supabase.from('classes').update({
      name: edit.name.trim(), age_group: edit.age_group.trim() || null,
      capacity: edit.capacity ? Number(edit.capacity) : null,
      description: edit.description.trim() || null,
      homeroom_staff_id: edit.homeroom_staff_id || null,
    }).eq('id', editing.id)
    setSavingEdit(false)
    if (error) { setDrawerMsg(`저장 실패: ${error.message}`); return }
    setClasses((prev) => prev.map((c) => c.id === editing.id ? { ...c, name: edit.name, age_group: edit.age_group || null, capacity: edit.capacity ? Number(edit.capacity) : null, description: edit.description || null, homeroom_staff_id: edit.homeroom_staff_id || null } : c))
    setDrawerMsg('저장되었습니다.')
    router.refresh()
  }

  async function assignChild(childId: string, toClassId: string | null) {
    const { error } = await supabase.from('children').update({ class_id: toClassId }).eq('id', childId)
    if (error) { setDrawerMsg(`변경 실패: ${error.message}`); return }
    // update local children + classes membership
    const child = children.find((c) => c.id === childId)
    setChildren((prev) => prev.map((c) => c.id === childId ? { ...c, class_id: toClassId } : c))
    setClasses((prev) => prev.map((c) => {
      let kids = c.children.filter((k) => k.id !== childId)
      if (c.id === toClassId && child) kids = [...kids, { id: child.id, name: child.name, gender: 'male', status: child.status as ChildLite['status'] }]
      return { ...c, children: kids }
    }))
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 반을 삭제하시겠습니까? 배정된 아동은 미배정 상태가 됩니다.')) return
    await supabase.from('children').update({ class_id: null }).eq('class_id', id)
    const { error } = await supabase.from('classes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setClasses((prev) => prev.filter((c) => c.id !== id))
    setEditId(null)
    router.refresh()
  }

  const unassigned = children.filter((c) => c.class_id !== editing?.id && c.status === 'active')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-faint uppercase tracking-widest font-data">총 {classes.length}개 반 · {children.length}명 아동</span>
        <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 반 추가</Button>
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-line rounded-[3px]">
          <BookOpen size={32} className="text-line mb-3" />
          <p className="text-[12px] text-ink-ghost mb-4">등록된 반이 없습니다</p>
          <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 반 만들기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
          {classes.map((cls) => {
            const active = cls.children.filter((c) => c.status === 'active').length
            return (
              <Card key={cls.id} className="group cursor-pointer hover:border-line-strong transition-colors" >
                <CardHeader>
                  <button className="w-full text-left" onClick={() => openDrawer(cls)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{cls.name}</CardTitle>
                        <p className="text-[11px] text-ink-faint mt-1">
                          {cls.age_group ? `${cls.age_group} · ` : ''}{cls.homeroom_staff_id ? `담임 ${staffName.get(cls.homeroom_staff_id) ?? '—'}` : '담임 미지정'}
                        </p>
                      </div>
                      <Settings2 size={13} className="text-ink-ghost group-hover:text-accent transition-colors" />
                    </div>
                  </button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-[11px] mb-3">
                    <Users size={11} className="text-ink-faint" />
                    <span className="text-ink font-medium">{active}</span>
                    <span className="text-ink-faint">{cls.capacity ? `/ ${cls.capacity}명` : '명 재원'}</span>
                  </div>
                  {cls.children.length === 0 ? (
                    <p className="text-[11px] text-ink-ghost">배정된 아동이 없습니다</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {cls.children.slice(0, 10).map((child) => (
                        <span key={child.id} className="inline-flex items-center gap-1 text-[11px] text-ink-soft bg-fill border border-line rounded-[3px] px-1.5 py-0.5">
                          {child.name}
                        </span>
                      ))}
                      {cls.children.length > 10 && <span className="text-[10px] text-ink-ghost self-center">+{cls.children.length - 10}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError('') }} title="반 추가">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="반 이름 *" placeholder="예: 햇님반" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="연령" placeholder="예: 5세" value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })} />
            <Input label="정원" type="number" placeholder="최대 인원" value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <Textarea label="설명" rows={3} placeholder="반에 대한 설명" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <div className="border border-[color:var(--color-danger-soft)] bg-danger-soft px-3 py-2 text-[11px] text-danger rounded-[3px]">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>추가</Button>
          </div>
        </form>
      </Modal>

      {/* Edit / manage drawer */}
      <Drawer open={!!editing} onClose={() => setEditId(null)} title={editing?.name ?? '반 관리'} subtitle="반 속성 및 아동 배정 관리" width={440}
        footer={
          <div className="flex items-center justify-between">
            <Button variant="danger" size="sm" onClick={() => editing && handleDelete(editing.id)}><Trash2 size={12} /> 반 삭제</Button>
            <Button size="sm" loading={savingEdit} onClick={saveEdit}>속성 저장</Button>
          </div>
        }>
        {editing && (
          <div className="p-4 space-y-5">
            {drawerMsg && <div className="text-[11px] text-accent bg-accent-soft px-3 py-2 rounded-[3px]">{drawerMsg}</div>}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">속성</p>
              <Input label="반 이름" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="연령" value={edit.age_group} onChange={(e) => setEdit({ ...edit, age_group: e.target.value })} />
                <Input label="정원" type="number" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} />
              </div>
              <Select label="담임 교사" value={edit.homeroom_staff_id} onChange={(e) => setEdit({ ...edit, homeroom_staff_id: e.target.value })}>
                <option value="">미지정</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role === 'director' ? '원장' : '교사'})</option>)}
              </Select>
              <Textarea label="설명" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">배정 아동 ({editing.children.length})</p>
              {editing.children.length === 0 ? (
                <p className="text-[11px] text-ink-ghost">배정된 아동이 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {editing.children.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 bg-fill-2 border border-line rounded-[3px]">
                      <span className="text-[12px] text-ink">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[9px] ${CHILD_STATUS_COLORS[c.status]}`}>{CHILD_STATUS_LABELS[c.status]}</Badge>
                        <button onClick={() => assignChild(c.id, null)} title="반에서 제거" className="text-ink-ghost hover:text-danger">
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">아동 추가</p>
              {unassigned.length === 0 ? (
                <p className="text-[11px] text-ink-ghost">추가할 수 있는 아동이 없습니다.</p>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {unassigned.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-fill rounded-[3px]">
                      <span className="text-[12px] text-ink-soft">{c.name}</span>
                      <button onClick={() => assignChild(c.id, editing.id)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover">
                        <UserPlus size={12} /> 배정
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
