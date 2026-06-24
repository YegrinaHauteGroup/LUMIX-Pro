'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS } from '@/lib/utils'
import type { Child } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { BookOpen, Plus, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ClassItem {
  id: string; name: string; description: string | null; capacity: number | null; created_at: string
  children: Pick<Child, 'id' | 'name' | 'gender' | 'status'>[]
}

interface Props { initialClasses: ClassItem[]; centerId: string }

const emptyForm = { name: '', description: '', capacity: '' }

export function ClassesClient({ initialClasses, centerId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [classes, setClasses] = useState(initialClasses)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.from('classes')
      .insert({ center_id: centerId, name: form.name, description: form.description || null, capacity: form.capacity ? Number(form.capacity) : null })
      .select('*, children(id, name, gender, status)').single()
    if (error) { setError(error.message); setLoading(false); return }
    setClasses((prev) => [...prev, data as ClassItem])
    setModalOpen(false); setForm(emptyForm); setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 반을 삭제하시겠습니까?')) return
    const { error } = await supabase
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setClasses((prev) => prev.filter((c) => c.id !== id))
    router.refresh()
  }

  return (
    <div className="flex-1 p-5 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#8a93a6] uppercase tracking-widest">총 {classes.length}개 반</span>
        <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 반 추가</Button>
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-[#e9edf4]">
          <BookOpen size={32} className="text-[#e6eaf2] mb-3" />
          <p className="text-[12px] text-[#aab2c2] mb-4">등록된 반이 없습니다</p>
          <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 반 만들기</Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map((cls) => {
            const active = cls.children.filter((c) => c.status === 'active').length
            return (
              <Card key={cls.id} className="group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{cls.name}</CardTitle>
                      {cls.description && <p className="text-[11px] text-[#8a93a6] mt-1">{cls.description}</p>}
                    </div>
                    <button onClick={() => handleDelete(cls.id)}
                      className="text-[#e6eaf2] hover:text-[#e5484d] transition-colors opacity-0 group-hover:opacity-100 p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-[11px] mb-3">
                    <Users size={11} className="text-[#8a93a6]" />
                    <span className="text-[#1c2740] font-medium">{active}</span>
                    <span className="text-[#8a93a6]">{cls.capacity ? `/ ${cls.capacity}명` : '명 재원'}</span>
                  </div>
                  {cls.children.length === 0 ? (
                    <p className="text-[11px] text-[#aab2c2]">배정된 아동이 없습니다</p>
                  ) : (
                    <div className="space-y-1">
                      {cls.children.slice(0, 6).map((child) => (
                        <Link key={child.id} href={`/children/${child.id}`}
                          className="flex items-center justify-between py-1 group/item">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-[#f1f4f9] border border-[#e6eaf2] flex items-center justify-center">
                              <span className="text-[9px] text-[#7a8499]">{child.name[0]}</span>
                            </div>
                            <span className="text-[11px] text-[#5a6678] group-hover/item:text-[#0e1726] transition-colors">{child.name}</span>
                          </div>
                          <Badge className={`text-[9px] ${CHILD_STATUS_COLORS[child.status]}`}>{CHILD_STATUS_LABELS[child.status]}</Badge>
                        </Link>
                      ))}
                      {cls.children.length > 6 && (
                        <p className="text-[10px] text-[#aab2c2] pt-1">+{cls.children.length - 6}명 더</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError('') }} title="반 추가">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="반 이름 *" placeholder="예: 햇살반" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="정원" type="number" placeholder="최대 인원 수" value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Textarea label="설명" rows={3} placeholder="반에 대한 설명" value={form.description}
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
