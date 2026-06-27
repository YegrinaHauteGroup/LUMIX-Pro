'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import {
  ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_COLORS,
  CHILD_STATUS_COLORS, CHILD_STATUS_LABELS, GENDER_LABELS, calculateAge, formatDate,
} from '@/lib/utils'
import type { Activity, Child, Class, ChildGuardian, HealthProfile, HealthEvent } from '@/lib/types'
import {
  BLOOD_TYPES, ALLERGEN_CLASSES, ICD11_CATEGORIES,
  HEALTH_EVENT_KINDS, SEVERITY, CATALOG_BY_DOMAIN, labelOf, isContagious,
} from '@/lib/ontology'
import { createClient } from '@/utils/supabase/client'
import { Activity as ActivityIcon, AlertTriangle, ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface Guardian { id: string; guardian_name: string; guardian_phone: string | null }

interface Props {
  child: Child & { center_id?: string }
  centerId: string
  classes: Pick<Class, 'id' | 'name'>[]
  staff: { id: string; name: string }[]
  health: HealthProfile | null
  links: ChildGuardian[]
  guardians: Guardian[]
  recentActivities: Activity[]
  healthEvents: HealthEvent[]
}

type Tab = 'basic' | 'health' | 'family' | 'dev'
const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: '기본 정보' },
  { key: 'health', label: '신체 · 건강' },
  { key: 'family', label: '가족 · 관계' },
  { key: 'dev', label: '발달 · 메모' },
]

const RELATIONSHIP_OPTIONS = ['부', '모', '조부', '조모', '형제', '자매', '친척', '기타']

export function ChildDetailClient({ child, centerId, classes, staff, health, links, guardians, recentActivities, healthEvents }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [form, setForm] = useState({
    name: child.name,
    birth_date: child.birth_date ?? '',
    gender: child.gender,
    class_id: child.class_id ?? '',
    status: child.status,
    enrollment_type: (child.enrollment_type ?? 'general') as 'general' | 'beneficiary',
    primary_teacher_id: child.primary_teacher_id ?? '',
    phone: child.phone ?? '',
    address: child.address ?? '',
    postal_code: child.postal_code ?? '',
    school_name: child.school_name ?? '',
    grade_level: child.grade_level ?? '',
    nationality: child.nationality ?? '',
    native_language: child.native_language ?? '',
    guardian_name: child.guardian_name ?? '',
    guardian_phone: child.guardian_phone ?? '',
    emergency_contact_name: child.emergency_contact_name ?? '',
    emergency_contact_phone: child.emergency_contact_phone ?? '',
    height_cm: child.height_cm?.toString() ?? '',
    weight_kg: child.weight_kg?.toString() ?? '',
    blood_type: child.blood_type ?? '',
    dietary_notes: child.dietary_notes ?? '',
    learning_level: child.learning_level ?? '',
    characteristics: child.characteristics ?? '',
    developmental_notes: child.developmental_notes ?? '',
    notes: child.notes ?? '',
  })
  const [hp, setHp] = useState({
    allergies: health?.allergies ?? '',
    medications: health?.medications ?? '',
    conditions: health?.conditions ?? '',
    allergen_codes: (health?.allergen_codes ?? []) as string[],
    chronic_condition_codes: (health?.chronic_condition_codes ?? []) as string[],
  })
  const toggleCode = (key: 'allergen_codes' | 'chronic_condition_codes', code: string) =>
    setHp((h) => ({ ...h, [key]: h[key].includes(code) ? h[key].filter((c) => c !== code) : [...h[key], code] }))

  // WHO-coded health events
  const [events, setEvents] = useState<HealthEvent[]>(healthEvents)
  const [ev, setEv] = useState({ kind: 'symptom', code: '', severity: 'mild', event_date: new Date().toISOString().slice(0, 10), note: '' })
  const evDomain = HEALTH_EVENT_KINDS.find((k) => k.code === ev.kind)?.domain ?? 'symptom'
  const evOptions = CATALOG_BY_DOMAIN[evDomain] ?? []

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function saveChild() {
    setSaving(true); setMsg(null)
    const { data, error } = await supabase.from('children').update({
      name: form.name,
      birth_date: form.birth_date || null,
      gender: form.gender,
      class_id: form.class_id || null,
      status: form.status,
      enrollment_type: form.enrollment_type,
      primary_teacher_id: form.primary_teacher_id || null,
      phone: form.phone || null,
      address: form.address || null,
      postal_code: form.postal_code || null,
      school_name: form.school_name || null,
      grade_level: form.grade_level || null,
      nationality: form.nationality || null,
      native_language: form.native_language || null,
      guardian_name: form.guardian_name || null,
      guardian_phone: form.guardian_phone || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      blood_type: form.blood_type || null,
      dietary_notes: form.dietary_notes || null,
      learning_level: form.learning_level || null,
      characteristics: form.characteristics || null,
      developmental_notes: form.developmental_notes || null,
      notes: form.notes || null,
    }).eq('id', child.id).select('id')
    setSaving(false)
    if (error) { setMsg({ kind: 'err', text: `저장 실패: ${error.message}` }); return }
    if (!data || data.length === 0) { setMsg({ kind: 'err', text: '저장 권한이 없거나 대상을 찾을 수 없습니다.' }); return }
    setMsg({ kind: 'ok', text: '저장되었습니다.' }); router.refresh()
  }

  async function saveHealth() {
    setSaving(true); setMsg(null)
    const payload = {
      allergies: hp.allergies || null, medications: hp.medications || null, conditions: hp.conditions || null,
      allergen_codes: hp.allergen_codes, chronic_condition_codes: hp.chronic_condition_codes,
    }
    let error
    if (health?.id) {
      ({ error } = await supabase.from('health_profiles').update(payload).eq('id', health.id))
    } else {
      ({ error } = await supabase.from('health_profiles').insert({ center_id: centerId, child_id: child.id, ...payload }))
    }
    setSaving(false)
    if (error) { setMsg({ kind: 'err', text: `건강정보 저장 실패: ${error.message}` }); return }
    setMsg({ kind: 'ok', text: '건강 정보가 저장되었습니다.' }); router.refresh()
  }

  async function addEvent() {
    if (!ev.code) { setMsg({ kind: 'err', text: '항목을 선택하세요.' }); return }
    setSaving(true); setMsg(null)
    const label = labelOf(evDomain, ev.code)
    const contagious = evDomain === 'symptom' ? isContagious('symptom', ev.code) : (evDomain === 'icd11_category' && ev.code === 'INFECTIOUS')
    const { data, error } = await supabase.from('health_events').insert({
      center_id: centerId, child_id: child.id, event_date: ev.event_date, kind: ev.kind,
      domain: evDomain, code: ev.code, label, severity: ev.severity, contagious, note: ev.note || null,
    }).select('id, event_date, kind, domain, code, label, severity, status, contagious, note').single()
    setSaving(false)
    if (error) { setMsg({ kind: 'err', text: `이벤트 저장 실패: ${error.message}` }); return }
    setEvents((e) => [data as HealthEvent, ...e])
    setEv((s) => ({ ...s, code: '', note: '' }))
    setMsg({ kind: 'ok', text: '건강 이벤트가 기록되었습니다.' })
  }

  async function toggleResolve(id: string, status: 'active' | 'resolved') {
    const next = status === 'active' ? 'resolved' : 'active'
    await supabase.from('health_events').update({ status: next, resolved_on: next === 'resolved' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id)
    setEvents((e) => e.map((x) => x.id === id ? { ...x, status: next } : x))
  }
  async function removeEvent(id: string) {
    await supabase.from('health_events').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setEvents((e) => e.filter((x) => x.id !== id))
  }

  const age = child.birth_date ? `${calculateAge(child.birth_date)}세` : '나이 미등록'

  return (
    <div className="flex-1 min-h-0 p-5 w-full space-y-5 overflow-auto">
      <div className="flex items-center justify-between">
        <Link href="/children" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors">
          <ArrowLeft size={14} /> 아동 목록으로
        </Link>
        {msg && (
          <span className={`text-[12px] ${msg.kind === 'ok' ? 'text-[color:var(--color-success)]' : 'text-danger'}`}>{msg.text}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="col-span-1 h-fit">
          <CardContent className="pt-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-[3px] bg-accent-soft border border-line flex items-center justify-center">
                <span className="text-2xl font-semibold text-accent">{child.name[0]}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{child.name}</h2>
                <p className="text-sm text-ink-faint">{age} · {GENDER_LABELS[child.gender]}</p>
              </div>
              <Badge className={CHILD_STATUS_COLORS[child.status]}>{CHILD_STATUS_LABELS[child.status]}</Badge>
            </div>
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              {[
                ['소속 반', (child.classes as Class | undefined)?.name ?? '미배정'],
                ['담임 교사', staff.find((s) => s.id === form.primary_teacher_id)?.name ?? '미배정'],
                ['이용 유형', form.enrollment_type === 'beneficiary' ? '수급/지원' : '일반'],
                ['학교', child.school_name ?? '—'],
                ['연락처', child.phone ?? child.guardian_phone ?? '—'],
                ['등록일', formatDate(child.created_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-ink-faint mb-0.5">{k}</p>
                  <p className="text-sm text-ink">{v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="col-span-2">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-1 p-1 bg-fill rounded-[3px] border border-line w-fit">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={'px-3.5 h-8 rounded-[3px] text-[12.5px] font-medium transition-colors ' +
                    (tab === t.key ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:text-ink')}>
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tab === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="이름 *" value={form.name} onChange={(e) => set('name', e.target.value)} />
                  <Input label="생년월일" type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="성별" value={form.gender} onChange={(e) => set('gender', e.target.value as Child['gender'])}>
                    <option value="male">남</option><option value="female">여</option><option value="other">기타</option>
                  </Select>
                  <Select label="재원 상태" value={form.status} onChange={(e) => set('status', e.target.value as Child['status'])}>
                    <option value="active">재원</option><option value="leave">휴원</option><option value="inactive">퇴원</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="반" value={form.class_id} onChange={(e) => set('class_id', e.target.value)}>
                    <option value="">반 미배정</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Select label="담임 교사" value={form.primary_teacher_id} onChange={(e) => set('primary_teacher_id', e.target.value)}>
                    <option value="">미배정</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="이용 유형" value={form.enrollment_type} onChange={(e) => set('enrollment_type', e.target.value as 'general' | 'beneficiary')}>
                    <option value="general">일반</option><option value="beneficiary">수급/지원</option>
                  </Select>
                  <Input label="아동 연락처" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <Input label="주소" value={form.address} onChange={(e) => set('address', e.target.value)} />
                  <Input label="우편번호" value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="학교/기관" value={form.school_name} onChange={(e) => set('school_name', e.target.value)} />
                  <Input label="학년/단계" value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="국적" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
                  <Input label="사용 언어" value={form.native_language} onChange={(e) => set('native_language', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="대표 보호자" value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
                  <Input label="보호자 연락처" value={form.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="비상 연락처 이름" value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} />
                  <Input label="비상 연락처 번호" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} />
                </div>
                <SaveBar saving={saving} onSave={saveChild} />
              </>
            )}

            {tab === 'health' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="키 (cm)" type="number" value={form.height_cm} onChange={(e) => set('height_cm', e.target.value)} />
                  <Input label="몸무게 (kg)" type="number" value={form.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
                  <Select label="혈액형 (ISBT ABO/Rh)" value={form.blood_type} onChange={(e) => set('blood_type', e.target.value)}>
                    <option value="">미등록</option>
                    {BLOOD_TYPES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                  </Select>
                </div>
                <Textarea label="식이 특이사항" rows={2} value={form.dietary_notes} onChange={(e) => set('dietary_notes', e.target.value)} placeholder="편식, 식사 보조 필요 등" />
                <SaveBar saving={saving} onSave={saveChild} label="신체 정보 저장" />

                {/* Coded allergens (Codex/WHO) */}
                <div className="border-t border-line pt-4 space-y-3">
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.08em]">표준 알레르겐 · Codex/WHO</p>
                  <ChipSelect items={ALLERGEN_CLASSES} selected={hp.allergen_codes} onToggle={(c) => toggleCode('allergen_codes', c)} />
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.08em] pt-1">기저 질환 분류 · WHO ICD-11</p>
                  <ChipSelect items={ICD11_CATEGORIES} selected={hp.chronic_condition_codes} onToggle={(c) => toggleCode('chronic_condition_codes', c)} />
                  <Textarea label="알레르기 비고 (자유 기술)" rows={2} value={hp.allergies} onChange={(e) => setHp((h) => ({ ...h, allergies: e.target.value }))} placeholder="예: 견과류 미량에도 반응" />
                  <Textarea label="복용 약물" rows={2} value={hp.medications} onChange={(e) => setHp((h) => ({ ...h, medications: e.target.value }))} />
                  <Textarea label="기타 특이사항" rows={2} value={hp.conditions} onChange={(e) => setHp((h) => ({ ...h, conditions: e.target.value }))} />
                  <SaveBar saving={saving} onSave={saveHealth} label="건강 프로필 저장" />
                </div>

                {/* WHO-coded health events */}
                <div className="border-t border-line pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ActivityIcon size={14} className="text-danger" />
                    <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.08em]">건강 이벤트 · WHO 코드 기반 (SNA 추론 연계)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="유형" value={ev.kind} onChange={(e) => setEv((s) => ({ ...s, kind: e.target.value, code: '' }))}>
                      {HEALTH_EVENT_KINDS.map((k) => <option key={k.code} value={k.code}>{k.label} · {k.standard}</option>)}
                    </Select>
                    <Select label="항목" value={ev.code} onChange={(e) => setEv((s) => ({ ...s, code: e.target.value }))}>
                      <option value="">선택…</option>
                      {evOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Select label="중증도" value={ev.severity} onChange={(e) => setEv((s) => ({ ...s, severity: e.target.value }))}>
                      {SEVERITY.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                    </Select>
                    <Input label="발생일" type="date" value={ev.event_date} onChange={(e) => setEv((s) => ({ ...s, event_date: e.target.value }))} />
                    <div className="flex items-end"><Button className="w-full" loading={saving} onClick={addEvent}><Plus size={13} /> 기록</Button></div>
                  </div>
                  {events.length === 0 ? (
                    <p className="text-[12px] text-ink-ghost py-2">기록된 건강 이벤트가 없습니다.</p>
                  ) : (
                    <div className="border border-line rounded-[3px] divide-y divide-[color:var(--color-line)] max-h-64 overflow-y-auto">
                      {events.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-[11px] text-ink-faint font-data tabular-nums w-[72px] shrink-0">{e.event_date}</span>
                          <span className="text-[12px] text-ink font-medium flex-1 min-w-0 truncate">{e.label ?? e.code}</span>
                          {e.contagious && <span title="전염성"><AlertTriangle size={12} className="text-danger shrink-0" /></span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] shrink-0 ${e.severity === 'severe' ? 'text-danger bg-danger-soft' : e.severity === 'moderate' ? 'text-warn bg-warn-soft' : 'text-ink-soft bg-fill'}`}>
                            {SEVERITY.find((s) => s.code === e.severity)?.label}
                          </span>
                          <button onClick={() => toggleResolve(e.id, e.status)} title={e.status === 'active' ? '해소 처리' : '재개'}
                            className={`text-[10px] px-1.5 py-0.5 rounded-[2px] shrink-0 ${e.status === 'resolved' ? 'text-[color:var(--color-success)] bg-success-soft' : 'text-info bg-info-soft'}`}>
                            {e.status === 'resolved' ? '해소' : '진행'}
                          </button>
                          <button onClick={() => removeEvent(e.id)} className="text-ink-ghost hover:text-danger shrink-0"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'family' && (
              <FamilyTab child={child} centerId={centerId} links={links} guardians={guardians} supabase={supabase} setMsg={setMsg} />
            )}

            {tab === 'dev' && (
              <>
                <Input label="학습 수준" value={form.learning_level} onChange={(e) => set('learning_level', e.target.value)} placeholder="예: 한글 읽기 가능, 수 세기 10까지" />
                <Textarea label="성향 / 특징" rows={3} value={form.characteristics} onChange={(e) => set('characteristics', e.target.value)} placeholder="성격, 관심사, 또래 관계 특성 등" />
                <Textarea label="발달 기록" rows={3} value={form.developmental_notes} onChange={(e) => set('developmental_notes', e.target.value)} placeholder="발달 관찰, 상담 내용 등" />
                <Textarea label="메모" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="기타 특이사항" />
                <SaveBar saving={saving} onSave={saveChild} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participation */}
      <Card>
        <CardHeader><CardTitle>참여 활동</CardTitle></CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-ink-faint py-4 text-center">참여한 활동이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentActivities.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] bg-fill border border-line">
                  <div className={`w-1.5 h-8 rounded-full ${ACTIVITY_TYPE_COLORS[a.type]?.split(' ')[1]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{a.title}</p>
                    <p className="text-xs text-ink-faint">{a.activity_date ?? '날짜 미정'}</p>
                  </div>
                  <Badge className={ACTIVITY_STATUS_COLORS[a.status]}>{ACTIVITY_STATUS_LABELS[a.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SaveBar({ saving, onSave, label = '저장' }: { saving: boolean; onSave: () => void; label?: string }) {
  return (
    <div className="flex justify-end pt-1">
      <Button onClick={onSave} loading={saving}><Save size={14} /> {label}</Button>
    </div>
  )
}

function ChipSelect({ items, selected, onToggle }: { items: { code: string; label: string }[]; selected: string[]; onToggle: (code: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.includes(it.code)
        return (
          <button key={it.code} type="button" onClick={() => onToggle(it.code)}
            className={'text-[11.5px] px-2 py-1 rounded-[3px] border transition-colors ' +
              (on ? 'bg-accent-soft border-accent text-accent-ink font-medium' : 'bg-surface border-line text-ink-soft hover:bg-fill')}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

type SB = ReturnType<typeof createClient>
type Setter = (m: { kind: 'ok' | 'err'; text: string } | null) => void

function FamilyTab({ child, centerId, links, guardians, supabase, setMsg }: {
  child: Child; centerId: string; links: ChildGuardian[]; guardians: Guardian[]; supabase: SB; setMsg: Setter
}) {
  const router = useRouter()
  const [guardianId, setGuardianId] = useState('')
  const [relationship, setRelationship] = useState('모')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [busy, setBusy] = useState(false)

  async function addExisting() {
    if (!guardianId) { setMsg({ kind: 'err', text: '보호자를 선택하세요.' }); return }
    setBusy(true)
    const { error } = await supabase.from('child_guardians').insert({
      center_id: centerId, child_id: child.id, guardian_id: guardianId,
      relationship, is_primary: links.length === 0,
    })
    setBusy(false)
    if (error) { setMsg({ kind: 'err', text: `연결 실패: ${error.message}` }); return }
    setGuardianId(''); router.refresh()
  }

  async function createAndLink() {
    if (!newName.trim()) { setMsg({ kind: 'err', text: '보호자 이름을 입력하세요.' }); return }
    setBusy(true)
    const { data: g, error: gErr } = await supabase.from('guardian_profiles')
      .insert({ center_id: centerId, guardian_name: newName.trim(), guardian_phone: newPhone || null })
      .select('id').single()
    if (gErr || !g) { setBusy(false); setMsg({ kind: 'err', text: `보호자 생성 실패: ${gErr?.message}` }); return }
    const { error } = await supabase.from('child_guardians').insert({
      center_id: centerId, child_id: child.id, guardian_id: g.id, relationship, is_primary: links.length === 0,
    })
    setBusy(false)
    if (error) { setMsg({ kind: 'err', text: `연결 실패: ${error.message}` }); return }
    setNewName(''); setNewPhone(''); router.refresh()
  }

  async function toggle(linkId: string, field: 'is_primary' | 'is_emergency_contact' | 'can_pickup', value: boolean) {
    await supabase.from('child_guardians').update({ [field]: value }).eq('id', linkId)
    router.refresh()
  }
  async function remove(linkId: string) {
    await supabase.from('child_guardians').update({ deleted_at: new Date().toISOString() }).eq('id', linkId)
    router.refresh()
  }

  const linkedIds = new Set(links.map((l) => l.guardian_id))
  const available = guardians.filter((g) => !linkedIds.has(g.id))

  return (
    <div className="space-y-4">
      {links.length === 0 ? (
        <p className="text-sm text-ink-faint py-2">연결된 가족이 없습니다. 아래에서 추가하세요.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-5 py-3.5 rounded-[3px] border border-line bg-surface">
              <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-accent">{l.guardian_profiles?.guardian_name?.[0] ?? '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink truncate">
                  {l.guardian_profiles?.guardian_name ?? '보호자'}
                  <span className="ml-1.5 text-ink-faint font-normal">{l.relationship}</span>
                </p>
                <p className="text-[11px] text-ink-faint">{l.guardian_profiles?.guardian_phone ?? '연락처 없음'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Toggle on={l.is_primary} label="대표" onClick={() => toggle(l.id, 'is_primary', !l.is_primary)} />
                <Toggle on={l.is_emergency_contact} label="비상" onClick={() => toggle(l.id, 'is_emergency_contact', !l.is_emergency_contact)} />
                <Toggle on={l.can_pickup} label="인계" onClick={() => toggle(l.id, 'can_pickup', !l.can_pickup)} />
                <button onClick={() => remove(l.id)} className="text-ink-ghost hover:text-danger transition-colors p-1"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.08em]">기존 보호자 연결</p>
          <Select label="" value={guardianId} onChange={(e) => setGuardianId(e.target.value)}>
            <option value="">보호자 선택</option>
            {available.map((g) => <option key={g.id} value={g.id}>{g.guardian_name}</option>)}
          </Select>
          <Select label="" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Button variant="secondary" className="w-full" onClick={addExisting} loading={busy}><Plus size={13} /> 연결</Button>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.08em]">새 보호자 추가</p>
          <Input label="" placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input label="" placeholder="연락처" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <Button className="w-full" onClick={createAndLink} loading={busy}><Plus size={13} /> 추가 및 연결</Button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={'px-2 h-6 rounded-[3px] text-[10px] font-semibold transition-colors ' +
        (on ? 'bg-accent-soft text-accent' : 'bg-fill text-ink-ghost hover:text-ink-soft')}>
      {label}
    </button>
  )
}
