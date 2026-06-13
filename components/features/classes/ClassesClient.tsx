'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS } from '@/lib/utils'
import type { Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { BookOpen, Plus, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ExtendedClass {
  id: string
  name: string
  description: string | null
  capacity: number | null
  created_at: string
  children: Pick<Child, 'id' | 'name' | 'gender' | 'status'>[]
}

interface Props {
  initialClasses: ExtendedClass[]
}

const emptyForm = { name: '', description: '', capacity: '' }

export function ClassesClient({ initialClasses }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [classes, setClasses] = useState(initialClasses)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: form.name,
        description: form.description || null,
        capacity: form.capacity ? Number(form.capacity) : null,
      })
      .select('*, children(id, name, gender, status)')
      .single()

    if (error) { setError(error.message); setLoading(false); return }

    setClasses((prev) => [...prev, data as ExtendedClass])
    setModalOpen(false)
    setForm(emptyForm)
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 반을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (!error) setClasses((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#555555]">총 {classes.length}개 반</span>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} />
          반 추가
        </Button>
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={40} className="text-[#2a2a2a] mb-4" />
          <p className="text-[#555555] text-sm">등록된 반이 없습니다</p>
          <Button className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            첫 번째 반 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map((cls) => {
            const active = cls.children.filter((c) => c.status === 'active').length
            return (
              <Card key={cls.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{cls.name}</CardTitle>
                      {cls.description && (
                        <p className="text-xs text-[#555555] mt-1">{cls.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(cls.id)}
                      className="text-[#2a2a2a] group-hover:text-[#444444] hover:!text-red-400 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users size={14} className="text-[#555555]" />
                      <span className="text-[#e0e0e0] font-medium">{active}</span>
                      <span className="text-[#555555]">
                        {cls.capacity ? `/ ${cls.capacity}명` : '명 재원'}
                      </span>
                    </div>
                  </div>

                  {cls.children.length === 0 ? (
                    <p className="text-xs text-[#444444]">배정된 아동이 없습니다</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cls.children.slice(0, 6).map((child) => (
                        <Link
                          key={child.id}
                          href={`/children/${child.id}`}
                          className="flex items-center justify-between py-1 hover:text-indigo-400 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-indigo-600/10 flex items-center justify-center">
                              <span className="text-[10px] text-indigo-400">{child.name[0]}</span>
                            </div>
                            <span className="text-xs text-[#a0a0a0]">{child.name}</span>
                          </div>
                          <Badge className={`text-[10px] ${CHILD_STATUS_COLORS[child.status]}`}>
                            {CHILD_STATUS_LABELS[child.status]}
                          </Badge>
                        </Link>
                      ))}
                      {cls.children.length > 6 && (
                        <p className="text-xs text-[#444444] pt-1">
                          +{cls.children.length - 6}명 더 있음
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="반 추가">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input
            label="반 이름 *"
            placeholder="예: 햇살반"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="정원"
            type="number"
            placeholder="최대 인원 수"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
          <Textarea
            label="설명"
            rows={3}
            placeholder="반에 대한 설명"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>추가</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
