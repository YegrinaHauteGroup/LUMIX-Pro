'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS } from '@/lib/utils'
import type { Activity, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CalendarDays, Network, Plus, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface ChildLite { id: string; name: string; class_id: string | null; status: string }
interface Part { activity_id: string; child_id: string }
interface CtxEdge { source_id: string; target_id: string; label: string | null; relation_type: string; context_activity_id: string }
interface Props {
  initialActivities: Activity[]
  classes: Pick<Class, 'id' | 'name'>[]
  allChildren: ChildLite[]
  participations: Part[]
  contextEdges: CtxEdge[]
  centerId: string
}

const emptyForm = {
  title: '', description: '', activity_date: '', activity_time: '',
  class_id: '', type: 'education' as Activity['type'], status: 'planned' as Activity['status'],
}

export function ActivitiesClient({ initialActivities, classes, allChildren, participations, contextEdges, centerId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activities, setActivities] = useState(initialActivities)
  const [parts, setParts] = useState<Part[]>(participations)
  const [filterType, setFilterType] = useState<Activity['type'] | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<Activity['status'] | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manageId, setManageId] = useState<string | null>(null)

  const nameOf = useMemo(() => new Map(allChildren.map((c) => [c.id, c.name])), [allChildren])
  const countByActivity = useMemo(() => {
    const m = new Map<string, number>()
    parts.forEach((p) => m.set(p.activity_id, (m.get(p.activity_id) ?? 0) + 1))
    return m
  }, [parts])

  const filtered = activities.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    return true
  })
  const managing = activities.find((a) => a.id === manageId) ?? null
  const managingParts = parts.filter((p) => p.activity_id === manageId)
  const managingPartIds = new Set(managingParts.map((p) => p.child_id))
  const managingEdges = contextEdges.filter((e) => e.context_activity_id === manageId)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centerId) { setError('센터 정보를 찾을 수 없습니다.'); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.from('activities')
      .insert({ center_id: centerId, title: form.title, description: form.description || null, activity_date: form.activity_date || null, activity_time: form.activity_time || null, class_id: form.class_id || null, type: form.type, status: form.status })
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
    const { error } = await supabase.from('activities').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    setActivities((prev) => prev.filter((a) => a.id !== id))
    if (manageId === id) setManageId(null)
    router.refresh()
  }

  async function addParticipant(activityId: string, childId: string) {
    const { data: upd } = await supabase.from('activity_participations').update({ deleted_at: null }).eq('activity_id', activityId).eq('child_id', childId).select('id')
    if (!upd || upd.length === 0) {
      const { error } = await supabase.from('activity_participations').insert({ center_id: centerId, activity_id: activityId, child_id: childId })
      if (error) { alert(`추가 실패: ${error.message}`); return }
    }
    setParts((p) => [...p, { activity_id: activityId, child_id: childId }])
    router.refresh()
  }
  async function removeParticipant(activityId: string, childId: string) {
    const { error } = await supabase.from('activity_participations').update({ deleted_at: new Date().toISOString() }).eq('activity_id', activityId).eq('child_id', childId)
    if (error) { alert(`제거 실패: ${error.message}`); return }
    setParts((p) => p.filter((x) => !(x.activity_id === activityId && x.child_id === childId)))
    router.refresh()
  }

  const addable = allChildren.filter((c) => !managingPartIds.has(c.id))

  return (
    <div className="flex-1 p-5 w-full space-y-5 overflow-auto">
      <div className="flex items-center gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="bg-surface border border-line px-3 text-[12px] text-ink-soft focus:outline-none focus:border-accent h-8 rounded-[3px] cursor-pointer">
          <option value="all">전체 유형</option>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as Activity['type'][]).map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-surface border border-line px-3 text-[12px] text-ink-soft focus:outline-none focus:border-accent h-8 rounded-[3px] cursor-pointer">
          <option value="all">전체 상태</option>
          {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-[11px] text-ink-faint">{filtered.length}개</span>
        <Button onClick={() => setModalOpen(true)} size="sm"><Plus size={12} /> 활동 추가</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                {['제목', '날짜', '시간', '반', '유형', '참여', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-ink-faint font-medium uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16">
                  <CalendarDays size={28} className="mx-auto mb-2 text-line" />
                  <p className="text-[12px] text-ink-ghost">등록된 활동이 없습니다</p>
                </td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-b border-line hover:bg-fill transition-colors">
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-2 text-left" onClick={() => setManageId(a.id)}>
                      <div className={`w-0.5 h-5 ${ACTIVITY_TYPE_COLORS[a.type]?.split(' ')[1] ?? 'bg-ink-ghost'}`} />
                      <span className="text-[12px] font-medium text-ink hover:text-accent transition-colors">{a.title}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-soft">{a.activity_date ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-soft">{a.activity_time ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-soft">{(a.classes as Class | undefined)?.name ?? '전체'}</td>
                  <td className="px-4 py-3"><Badge className={ACTIVITY_TYPE_COLORS[a.type]}>{ACTIVITY_TYPE_LABELS[a.type]}</Badge></td>
                  <td className="px-4 py-3">
                    <button onClick={() => setManageId(a.id)} className="inline-flex items-center gap-1 text-[11px] text-ink-soft hover:text-accent">
                      <Users size={12} /> {countByActivity.get(a.id) ?? 0}명
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select value={a.status} onChange={(e) => handleStatusChange(a.id, e.target.value as Activity['status'])}
                      className={`text-[10px] px-2 py-0.5 border-0 cursor-pointer focus:outline-none bg-transparent uppercase tracking-wider ${ACTIVITY_STATUS_COLORS[a.status]}`}>
                      {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(a.id)} className="text-line-strong hover:text-danger transition-colors p-1"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError('') }} title="활동 추가" size="md">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="활동명 *" placeholder="예: 미술 치료 프로그램" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="날짜" type="date" value={form.activity_date} onChange={(e) => setForm({ ...form, activity_date: e.target.value })} />
            <Input label="시간" type="time" value={form.activity_time} onChange={(e) => setForm({ ...form, activity_time: e.target.value })} />
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
          <Textarea label="설명" rows={3} placeholder="활동에 대한 설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {error && <div className="border border-[color:var(--color-danger-soft)] bg-danger-soft px-3 py-2 text-[11px] text-danger rounded-[3px]">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>취소</Button>
            <Button type="submit" loading={loading}>추가</Button>
          </div>
        </form>
      </Modal>

      {/* Manage drawer (participants + SNA linkage) */}
      <Drawer open={!!managing} onClose={() => setManageId(null)} title={managing?.title ?? '활동'} subtitle="참여 아동 및 SNA 연계 관리" width={440}>
        {managing && (
          <div className="p-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge className={ACTIVITY_TYPE_COLORS[managing.type]}>{ACTIVITY_TYPE_LABELS[managing.type]}</Badge>
              <Badge className={ACTIVITY_STATUS_COLORS[managing.status]}>{ACTIVITY_STATUS_LABELS[managing.status]}</Badge>
              <span className="text-[11px] text-ink-faint self-center">{managing.activity_date ?? '날짜 미정'}{managing.activity_time ? ` ${managing.activity_time.slice(0, 5)}` : ''}</span>
            </div>
            {managing.description && <p className="text-[12px] text-ink-soft leading-relaxed">{managing.description}</p>}

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">참여 아동 ({managingParts.length})</p>
              {managingParts.length === 0 ? <p className="text-[11px] text-ink-ghost">참여 아동이 없습니다.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {managingParts.map((p) => (
                    <span key={p.child_id} className="inline-flex items-center gap-1 text-[11px] text-ink-soft bg-fill border border-line rounded-[3px] pl-2 pr-1 py-0.5">
                      {nameOf.get(p.child_id) ?? '아동'}
                      <button onClick={() => removeParticipant(managing.id, p.child_id)} className="text-ink-ghost hover:text-danger"><UserMinus size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">아동 추가</p>
              {addable.length === 0 ? <p className="text-[11px] text-ink-ghost">추가할 아동이 없습니다.</p> : (
                <div className="max-h-[180px] overflow-y-auto space-y-1">
                  {addable.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-fill rounded-[3px]">
                      <span className="text-[12px] text-ink-soft">{c.name}</span>
                      <button onClick={() => addParticipant(managing.id, c.id)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover"><UserPlus size={12} /> 참여</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider flex items-center gap-1.5"><Network size={12} /> 이 활동에서 발생한 관계 ({managingEdges.length})</p>
              {managingEdges.length === 0 ? (
                <p className="text-[11px] text-ink-ghost">연계된 SNA 관계가 없습니다. 활동 중 관찰된 상호작용이 관계망에 반영됩니다.</p>
              ) : (
                <div className="space-y-1">
                  {managingEdges.map((e, i) => (
                    <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-fill-2 border border-line rounded-[3px]">
                      <span className="text-[12px] text-ink">{nameOf.get(e.source_id) ?? '—'} ↔ {nameOf.get(e.target_id) ?? '—'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] ${e.relation_type === 'conflict' ? 'text-danger bg-danger-soft' : 'text-accent bg-accent-soft'}`}>{e.label ?? e.relation_type}</span>
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
