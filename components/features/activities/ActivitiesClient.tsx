'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS } from '@/lib/utils'
import type { Activity, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { CalendarDays, Network, Plus, Save, Sparkles, Trash2, UserMinus, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const REL_LABELS: Record<string, string> = {
  play: '놀이', conflict: '갈등', help_seeking: '협동·도움', caregiving: '돌봄', communication: '소통', proximity: '근접',
}

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
  const [confirmDel, setConfirmDel] = useState<Activity | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  // In-app confirm (window.confirm is blocked in some embedded/preview frames,
  // which silently aborted deletes). `.select('id')` surfaces RLS 0-row cases.
  const handleDelete = async (id: string) => {
    setDeleting(true)
    const { data, error } = await supabase.from('activities').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id')
    setDeleting(false)
    if (error) { alert(`삭제 실패: ${error.message}`); return }
    if (!data || data.length === 0) { alert('삭제 권한이 없거나 대상을 찾을 수 없습니다.'); return }
    setActivities((prev) => prev.filter((a) => a.id !== id))
    if (manageId === id) setManageId(null)
    setConfirmDel(null)
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

  // ── detail-panel editing state ───────────────────────────────────────────
  const [edit, setEdit] = useState({ title: '', activity_date: '', activity_time: '', type: 'education' as Activity['type'], status: 'planned' as Activity['status'], description: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [record, setRecord] = useState('')
  const [rel, setRel] = useState({ a: '', b: '', type: 'play', label: '' })
  const [busy2, setBusy2] = useState(false)
  const [panelMsg, setPanelMsg] = useState<string | null>(null)

  useEffect(() => {
    if (managing) {
      setEdit({ title: managing.title, activity_date: managing.activity_date ?? '', activity_time: (managing.activity_time ?? '').slice(0, 5), type: managing.type, status: managing.status, description: managing.description ?? '' })
      setRecord(''); setRel({ a: '', b: '', type: 'play', label: '' }); setPanelMsg(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageId])

  async function saveActivity() {
    if (!managing) return
    setSavingEdit(true); setPanelMsg(null)
    const patch = { title: edit.title, activity_date: edit.activity_date || null, activity_time: edit.activity_time || null, type: edit.type, status: edit.status, description: edit.description || null }
    const { data, error } = await supabase.from('activities').update(patch).eq('id', managing.id).select('id')
    setSavingEdit(false)
    if (error || !data?.length) { setPanelMsg(`저장 실패: ${error?.message ?? '권한 확인 필요'}`); return }
    setActivities((prev) => prev.map((a) => (a.id === managing!.id ? { ...a, ...patch } as Activity : a)))
    setPanelMsg('활동 정보가 저장되었습니다.')
  }

  async function addOntologyEdge() {
    if (!managing) return
    if (!rel.a || !rel.b || rel.a === rel.b) { setPanelMsg('서로 다른 두 아동을 선택하세요.'); return }
    setBusy2(true); setPanelMsg(null)
    const { error } = await supabase.from('interactions').insert({
      center_id: centerId, source_kind: 'child', source_id: rel.a, target_kind: 'child', target_id: rel.b,
      relation_type: rel.type, label: rel.label || null, weight: 1, is_directed: false, context_activity_id: managing.id,
    })
    setBusy2(false)
    if (error) { setPanelMsg(`관계 입력 실패: ${error.message}`); return }
    setRel({ a: '', b: '', type: 'play', label: '' })
    setPanelMsg('온톨로지 관계가 관계망에 반영되었습니다.')
    router.refresh()
  }

  // reflect this activity's record into each participant's child records (care_notes · learning)
  async function reflectToData() {
    if (!managing) return
    if (managingParts.length === 0) { setPanelMsg('참여 아동이 없습니다. 먼저 아동을 추가하세요.'); return }
    const body = record.trim() || edit.description.trim() || managing.title
    setBusy2(true); setPanelMsg(null)
    const today = new Date().toISOString().slice(0, 10)
    const rows = managingParts.map((p) => ({ center_id: centerId, child_id: p.child_id, noted_on: today, note_type: 'learning' as const, content: `[활동: ${edit.title || managing.title}] ${body}` }))
    const { data, error } = await supabase.from('care_notes').insert(rows).select('id')
    setBusy2(false)
    if (error) { setPanelMsg(`반영 실패: ${error.message}`); return }
    setPanelMsg(`${data?.length ?? rows.length}명의 아동 학습 기록에 반영되었습니다.`)
  }

  return (
    <div className="flex-1 min-h-0 p-5 w-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
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

      <div className="flex gap-4 flex-1 min-h-0">
      <Card className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto min-h-0 flex-1">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-fill-2">
                {['제목', '날짜', '시간', '반', '유형', '참여', '상태', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-ink-faint font-semibold uppercase tracking-widest px-4 py-3 bg-fill-2">{h}</th>
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
                    <button onClick={() => setConfirmDel(a)} className="text-line-strong hover:text-danger transition-colors p-1"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail panel (1/3) — edit activity, log learning, ontology, reflect */}
      <Card className="w-[34%] xl:w-[32%] shrink-0 min-h-0 flex flex-col overflow-hidden">
        {!managing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <CalendarDays size={26} className="text-ink-ghost mb-2" />
            <p className="text-[12px] text-ink-soft font-medium">활동을 선택하세요</p>
            <p className="text-[10.5px] text-ink-faint mt-1">좌측 목록에서 활동을 클릭하면 상세 조정·학습 기록·온톨로지 입력을 할 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="h-10 px-3.5 flex items-center justify-between border-b border-line bg-fill-2 shrink-0">
              <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider truncate">활동 상세 · 편집</span>
              <button onClick={() => setManageId(null)} className="text-ink-faint hover:text-ink"><X size={14} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
              {/* edit fields */}
              <div className="space-y-2">
                <Input label="활동명" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="날짜" type="date" value={edit.activity_date} onChange={(e) => setEdit({ ...edit, activity_date: e.target.value })} />
                  <Input label="시간" type="time" value={edit.activity_time} onChange={(e) => setEdit({ ...edit, activity_time: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select label="유형" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Activity['type'] })}>
                    {(Object.keys(ACTIVITY_TYPE_LABELS) as Activity['type'][]).map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
                  </Select>
                  <Select label="상태" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Activity['status'] })}>
                    {(Object.keys(ACTIVITY_STATUS_LABELS) as Activity['status'][]).map((s) => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
                  </Select>
                </div>
                <Textarea label="설명" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                <Button size="sm" className="w-full" loading={savingEdit} onClick={saveActivity}><Save size={12} /> 활동 정보 저장</Button>
              </div>

              {/* participants */}
              <div className="space-y-2 pt-1 border-t border-line">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">참여 아동 ({managingParts.length})</p>
                {managingParts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {managingParts.map((p) => (
                      <span key={p.child_id} className="inline-flex items-center gap-1 text-[11px] text-ink-soft bg-fill border border-line rounded-[3px] pl-2 pr-1 py-0.5">
                        {nameOf.get(p.child_id) ?? '아동'}
                        <button onClick={() => removeParticipant(managing.id, p.child_id)} className="text-ink-ghost hover:text-danger"><UserMinus size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                {addable.length > 0 && (
                  <select value="" onChange={(e) => { if (e.target.value) addParticipant(managing.id, e.target.value) }}
                    className="w-full h-8 px-2 bg-fill-2 border border-line rounded-[3px] text-[12px] text-ink-soft">
                    <option value="">+ 아동 추가…</option>
                    {addable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              {/* learning record */}
              <div className="space-y-2 pt-1 border-t border-line">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">활동·학습 기록</p>
                <Textarea rows={3} placeholder="활동 진행 내역, 아동별 학습/성취/관찰 내용을 입력하세요." value={record} onChange={(e) => setRecord(e.target.value)} />
                <Button size="sm" variant="secondary" className="w-full" loading={busy2} onClick={reflectToData}><Sparkles size={12} /> 아동·시설 데이터에 반영</Button>
                <p className="text-[9.5px] text-ink-ghost">참여 아동 각각의 학습 기록(care_notes)으로 저장됩니다.</p>
              </div>

              {/* ontology relation input */}
              <div className="space-y-2 pt-1 border-t border-line">
                <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider flex items-center gap-1.5"><Network size={12} /> 온톨로지 관계 입력</p>
                <div className="grid grid-cols-2 gap-2">
                  <select value={rel.a} onChange={(e) => setRel({ ...rel, a: e.target.value })} className="h-8 px-2 bg-fill-2 border border-line rounded-[3px] text-[12px] text-ink-soft">
                    <option value="">아동 A</option>
                    {managingParts.map((p) => <option key={p.child_id} value={p.child_id}>{nameOf.get(p.child_id)}</option>)}
                  </select>
                  <select value={rel.b} onChange={(e) => setRel({ ...rel, b: e.target.value })} className="h-8 px-2 bg-fill-2 border border-line rounded-[3px] text-[12px] text-ink-soft">
                    <option value="">아동 B</option>
                    {managingParts.map((p) => <option key={p.child_id} value={p.child_id}>{nameOf.get(p.child_id)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={rel.type} onChange={(e) => setRel({ ...rel, type: e.target.value })} className="h-8 px-2 bg-fill-2 border border-line rounded-[3px] text-[12px] text-ink-soft">
                    {Object.entries(REL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <Input placeholder="라벨 (선택)" value={rel.label} onChange={(e) => setRel({ ...rel, label: e.target.value })} />
                </div>
                <Button size="sm" variant="secondary" className="w-full" loading={busy2} onClick={addOntologyEdge}><Plus size={12} /> 관계망에 추가</Button>
                {managingEdges.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {managingEdges.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-fill-2 border border-line rounded-[3px]">
                        <span className="text-[11px] text-ink">{nameOf.get(e.source_id) ?? '—'} ↔ {nameOf.get(e.target_id) ?? '—'}</span>
                        <span className={`text-[9.5px] px-1.5 py-0.5 rounded-[2px] ${e.relation_type === 'conflict' ? 'text-danger bg-danger-soft' : 'text-accent bg-accent-soft'}`}>{e.label ?? REL_LABELS[e.relation_type] ?? e.relation_type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {panelMsg && <div className="text-[11px] text-accent bg-accent-soft px-3 py-2 rounded-[3px]">{panelMsg}</div>}
            </div>
          </>
        )}
      </Card>
      </div>

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

      {/* Delete confirmation (in-app, not window.confirm) */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="활동 삭제" size="sm">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          <span className="font-semibold text-ink">{confirmDel?.title}</span> 활동을 삭제하시겠습니까?<br />삭제된 활동은 목록에서 제거됩니다.
        </p>
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="secondary" type="button" onClick={() => setConfirmDel(null)}>취소</Button>
          <Button type="button" loading={deleting} onClick={() => confirmDel && handleDelete(confirmDel.id)} className="!bg-danger hover:!bg-danger/90">삭제</Button>
        </div>
      </Modal>
    </div>
  )
}
