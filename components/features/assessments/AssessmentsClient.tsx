'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Trash2, RefreshCw, Plus, ArrowRight } from 'lucide-react'

type Dim = 'social' | 'communication' | 'learning' | 'self_help' | 'behavior' | 'health'

const DIM_LABELS: Record<Dim, string> = {
  social: '사회성', communication: '의사소통', learning: '학습',
  self_help: '자조', behavior: '행동', health: '건강',
}
const RELATION_LABELS: Record<string, string> = {
  play: '놀이', conflict: '갈등', help_seeking: '도움요청',
  caregiving: '돌봄', communication: '의사소통', proximity: '근접',
}
const KIND_LABELS: Record<string, string> = {
  child: '아동', staff: '교사', guardian: '보호자', system: '시스템',
}

interface Child { id: string; name: string }
interface Staff { id: string; name: string; role?: string }
interface Guardian { id: string; guardian_name: string; guardian_phone?: string | null }
interface Rule {
  id: string; center_id: string | null; source_kind: string; target_kind: string
  dimension: string; score_min: number; score_max: number; relation_type: string
  weight: number; is_directed: boolean
}
interface PeerA { id: string; from_child_id: string; to_child_id: string; dimension: string; score: number; assessed_on: string; notes: string | null }
interface StaffA { id: string; staff_id: string; child_id: string; dimension: string; score: number; assessed_on: string; notes: string | null }
interface GuardianA { id: string; guardian_profile_id: string | null; guardian_name: string | null; child_id: string; dimension: string; score: number; assessed_on: string; notes: string | null }

interface Props {
  centerId: string
  children: Child[]
  staff: Staff[]
  guardians: Guardian[]
  rules: Rule[]
  peerAssessments: PeerA[]
  staffAssessments: StaffA[]
  guardianAssessments: GuardianA[]
}

type Tab = 'peer' | 'staff' | 'guardian' | 'manage' | 'rules'
const TABS: { key: Tab; label: string }[] = [
  { key: 'peer', label: '또래 평가' },
  { key: 'staff', label: '교사 평가' },
  { key: 'guardian', label: '보호자 평가' },
  { key: 'manage', label: '보호자 관리' },
  { key: 'rules', label: '온톨로지 규칙' },
]

const today = () => new Date().toISOString().slice(0, 10)

export function AssessmentsClient(props: Props) {
  const { centerId } = props
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<Tab>('peer')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const childName = (id: string) => props.children.find((c) => c.id === id)?.name ?? '—'
  const staffName = (id: string) => props.staff.find((s) => s.id === id)?.name ?? '—'

  async function handleRebuild() {
    if (!centerId) return
    setBusy(true); setMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('recompute_sna_metrics', {
        body: { center_id: centerId, rebuild: true },
      })
      if (error) throw error
      setMsg({ kind: 'ok', text: `관계망 재생성 완료 · 노드 ${data?.nodes ?? 0} · 직접연결 ${data?.child_child_edges ?? 0} · 추론연결 ${data?.inferred_edges ?? 0}` })
      router.refresh()
    } catch (e) {
      setMsg({ kind: 'err', text: `실패: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 p-5 w-full space-y-5 overflow-auto">
      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-fill rounded-[3px] border border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setMsg(null) }}
              className={
                'px-3.5 h-8 rounded-[3px] text-[12.5px] font-medium transition-colors ' +
                (tab === t.key ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:text-ink')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button onClick={handleRebuild} loading={busy}>
          <RefreshCw size={13} /> 관계망 재생성 + 재계산
        </Button>
      </div>

      {msg && (
        <div className={
          'flex items-center gap-2 rounded-[3px] px-3.5 py-2.5 text-[12px] border ' +
          (msg.kind === 'ok'
            ? 'bg-[color:var(--color-success-soft)] border-[color:var(--color-success-soft)] text-[color:var(--color-success)]'
            : 'bg-[color:var(--color-danger-soft)] border-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]')
        }>
          {msg.text}
        </div>
      )}

      {tab === 'peer' && <PeerTab {...props} supabase={supabase} childName={childName} setMsg={setMsg} />}
      {tab === 'staff' && <StaffTab {...props} supabase={supabase} childName={childName} staffName={staffName} setMsg={setMsg} />}
      {tab === 'guardian' && <GuardianTab {...props} supabase={supabase} childName={childName} setMsg={setMsg} />}
      {tab === 'manage' && <ManageGuardians {...props} supabase={supabase} setMsg={setMsg} />}
      {tab === 'rules' && <RulesTab rules={props.rules} />}
    </div>
  )
}

/* ---------- shared field helpers ---------- */
type Setter = (m: { kind: 'ok' | 'err'; text: string } | null) => void
type SB = ReturnType<typeof createClient>

function DimSelect({ value, onChange }: { value: Dim; onChange: (d: Dim) => void }) {
  return (
    <Select label="영역" value={value} onChange={(e) => onChange(e.target.value as Dim)}>
      {(Object.keys(DIM_LABELS) as Dim[]).map((d) => <option key={d} value={d}>{DIM_LABELS[d]}</option>)}
    </Select>
  )
}

function ScoreField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const tone = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-600' : 'text-ink-faint'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.08em]">
        점수 <span className={tone}>{value > 0 ? `+${value}` : value}</span>
      </label>
      <input
        type="range" min={-100} max={100} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--color-accent)] h-9"
      />
      <p className="text-[10px] text-ink-ghost">음수 = 부정 / 갈등 · 양수 = 긍정 / 친밀</p>
    </div>
  )
}

function RecentTable<T extends { id: string }>({
  title, rows, render, onDelete,
}: { title: string; rows: T[]; render: (r: T) => React.ReactNode; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-[12px] text-ink-ghost text-center py-10">기록이 없습니다</p>
        ) : (
          <div className="divide-y divide-[color:var(--color-line)]">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-fill-2 transition-colors">
                <div className="flex-1 min-w-0">{render(r)}</div>
                <button onClick={() => onDelete(r.id)} className="text-ink-ghost hover:text-danger transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScoreChip({ score }: { score: number }) {
  const cls = score > 0 ? 'text-success bg-success-soft' : score < 0 ? 'text-danger bg-danger-soft' : 'text-ink-soft bg-fill'
  return <Badge className={cls}>{score > 0 ? `+${score}` : score}</Badge>
}

/* ---------- Peer ---------- */
function PeerTab({ centerId, children, peerAssessments, supabase, childName, setMsg }:
  Props & { supabase: SB; childName: (id: string) => string; setMsg: Setter }) {
  const router = useRouter()
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [dim, setDim] = useState<Dim>('social'); const [score, setScore] = useState(50)
  const [notes, setNotes] = useState(''); const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!from || !to || from === to) { setMsg({ kind: 'err', text: '서로 다른 두 아동을 선택하세요.' }); return }
    setLoading(true)
    const { error } = await supabase.from('peer_assessments').insert({
      center_id: centerId, from_child_id: from, to_child_id: to, dimension: dim, score, assessed_on: today(), notes: notes || null,
    })
    setLoading(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: '또래 평가가 저장되었습니다. 재계산을 눌러 관계망에 반영하세요.' })
    setNotes(''); router.refresh()
  }
  async function del(id: string) {
    await supabase.from('peer_assessments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-5 items-start">
      <Card>
        <CardHeader><CardTitle>또래 평가 입력 (아동 → 아동)</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <Select label="평가 아동" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">선택</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <ArrowRight size={14} className="text-ink-ghost mb-2.5" />
              <Select label="대상 아동" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">선택</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <DimSelect value={dim} onChange={setDim} />
            <ScoreField value={score} onChange={setScore} />
            <Input label="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="관찰 내용" />
            <Button type="submit" className="w-full" loading={loading}><Plus size={13} /> 평가 저장</Button>
          </form>
        </CardContent>
      </Card>
      <RecentTable title="최근 또래 평가" rows={peerAssessments} onDelete={del} render={(r) => (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium text-ink">{childName(r.from_child_id)}</span>
          <ArrowRight size={11} className="text-ink-ghost" />
          <span className="font-medium text-ink">{childName(r.to_child_id)}</span>
          <span className="text-ink-faint">· {DIM_LABELS[r.dimension as Dim] ?? r.dimension}</span>
          <ScoreChip score={r.score} />
          <span className="text-ink-ghost ml-auto text-[11px]">{r.assessed_on}</span>
        </div>
      )} />
    </div>
  )
}

/* ---------- Staff ---------- */
function StaffTab({ centerId, children, staff, staffAssessments, supabase, childName, staffName, setMsg }:
  Props & { supabase: SB; childName: (id: string) => string; staffName: (id: string) => string; setMsg: Setter }) {
  const router = useRouter()
  const [sid, setSid] = useState(''); const [cid, setCid] = useState('')
  const [dim, setDim] = useState<Dim>('communication'); const [score, setScore] = useState(50)
  const [notes, setNotes] = useState(''); const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!sid || !cid) { setMsg({ kind: 'err', text: '교사와 아동을 선택하세요.' }); return }
    setLoading(true)
    const { error } = await supabase.from('staff_child_assessments').insert({
      center_id: centerId, staff_id: sid, child_id: cid, dimension: dim, score, assessed_on: today(), notes: notes || null,
    })
    setLoading(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: '교사 평가가 저장되었습니다.' }); setNotes(''); router.refresh()
  }
  async function del(id: string) {
    await supabase.from('staff_child_assessments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-5 items-start">
      <Card>
        <CardHeader><CardTitle>교사 평가 입력 (교사 → 아동)</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Select label="교사" value={sid} onChange={(e) => setSid(e.target.value)}>
              <option value="">선택</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` (${s.role === 'director' ? '원장' : '교사'})` : ''}</option>)}
            </Select>
            <Select label="아동" value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">선택</option>
              {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <DimSelect value={dim} onChange={setDim} />
            <ScoreField value={score} onChange={setScore} />
            <Input label="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="관찰 내용" />
            <Button type="submit" className="w-full" loading={loading}><Plus size={13} /> 평가 저장</Button>
          </form>
        </CardContent>
      </Card>
      <RecentTable title="최근 교사 평가" rows={staffAssessments} onDelete={del} render={(r) => (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium text-ink">{staffName(r.staff_id)}</span>
          <ArrowRight size={11} className="text-ink-ghost" />
          <span className="font-medium text-ink">{childName(r.child_id)}</span>
          <span className="text-ink-faint">· {DIM_LABELS[r.dimension as Dim] ?? r.dimension}</span>
          <ScoreChip score={r.score} />
          <span className="text-ink-ghost ml-auto text-[11px]">{r.assessed_on}</span>
        </div>
      )} />
    </div>
  )
}

/* ---------- Guardian assessment ---------- */
function GuardianTab({ centerId, children, guardians, guardianAssessments, supabase, childName, setMsg }:
  Props & { supabase: SB; childName: (id: string) => string; setMsg: Setter }) {
  const router = useRouter()
  const [gid, setGid] = useState(''); const [cid, setCid] = useState('')
  const [dim, setDim] = useState<Dim>('communication'); const [score, setScore] = useState(50)
  const [notes, setNotes] = useState(''); const [loading, setLoading] = useState(false)
  const guardianName = (id: string) => guardians.find((g) => g.id === id)?.guardian_name ?? '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!gid || !cid) { setMsg({ kind: 'err', text: '보호자와 아동을 선택하세요.' }); return }
    setLoading(true)
    const { error } = await supabase.from('guardian_child_assessments').insert({
      center_id: centerId, guardian_profile_id: gid, guardian_name: guardianName(gid),
      child_id: cid, dimension: dim, score, assessed_on: today(), notes: notes || null,
    })
    setLoading(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: '보호자 평가가 저장되었습니다.' }); setNotes(''); router.refresh()
  }
  async function del(id: string) {
    await supabase.from('guardian_child_assessments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-5 items-start">
      <Card>
        <CardHeader><CardTitle>보호자 평가 입력 (보호자 → 아동)</CardTitle></CardHeader>
        <CardContent>
          {guardians.length === 0 ? (
            <p className="text-[12px] text-ink-faint py-6 text-center">
              등록된 보호자가 없습니다. <span className="text-accent">보호자 관리</span> 탭에서 먼저 추가하세요.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Select label="보호자" value={gid} onChange={(e) => setGid(e.target.value)}>
                <option value="">선택</option>
                {guardians.map((g) => <option key={g.id} value={g.id}>{g.guardian_name}</option>)}
              </Select>
              <Select label="아동" value={cid} onChange={(e) => setCid(e.target.value)}>
                <option value="">선택</option>
                {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <DimSelect value={dim} onChange={setDim} />
              <ScoreField value={score} onChange={setScore} />
              <Input label="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="관찰 내용" />
              <Button type="submit" className="w-full" loading={loading}><Plus size={13} /> 평가 저장</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <RecentTable title="최근 보호자 평가" rows={guardianAssessments} onDelete={del} render={(r) => (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium text-ink">{r.guardian_name ?? '보호자'}</span>
          <ArrowRight size={11} className="text-ink-ghost" />
          <span className="font-medium text-ink">{childName(r.child_id)}</span>
          <span className="text-ink-faint">· {DIM_LABELS[r.dimension as Dim] ?? r.dimension}</span>
          <ScoreChip score={r.score} />
          <span className="text-ink-ghost ml-auto text-[11px]">{r.assessed_on}</span>
        </div>
      )} />
    </div>
  )
}

/* ---------- Guardian management ---------- */
function ManageGuardians({ centerId, guardians, supabase, setMsg }:
  Props & { supabase: SB; setMsg: Setter }) {
  const router = useRouter()
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setMsg({ kind: 'err', text: '보호자 이름을 입력하세요.' }); return }
    setLoading(true)
    const { error } = await supabase.from('guardian_profiles').insert({
      center_id: centerId, guardian_name: name.trim(), guardian_phone: phone || null,
    })
    setLoading(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: '보호자가 추가되었습니다.' }); setName(''); setPhone(''); router.refresh()
  }
  async function del(id: string) {
    await supabase.from('guardian_profiles').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-[380px_1fr] gap-5 items-start">
      <Card>
        <CardHeader><CardTitle>보호자 추가</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input label="보호자 이름 *" value={name} onChange={(e) => setName(e.target.value)} placeholder="김보호" />
            <Input label="연락처" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
            <Button type="submit" className="w-full" loading={loading}><Plus size={13} /> 보호자 등록</Button>
          </form>
        </CardContent>
      </Card>
      <RecentTable title="보호자 목록" rows={guardians} onDelete={del} render={(g) => (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium text-ink">{g.guardian_name}</span>
          <span className="text-ink-faint">{g.guardian_phone ?? ''}</span>
        </div>
      )} />
    </div>
  )
}

/* ---------- Ontology rules ---------- */
function RulesTab({ rules }: { rules: Rule[] }) {
  const sorted = [...rules].sort((a, b) =>
    (a.dimension.localeCompare(b.dimension)) || (a.score_min - b.score_min))
  return (
    <Card>
      <CardHeader>
        <CardTitle>온톨로지 매핑 규칙 (sna_label_rules)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <p className="px-5 py-3 text-[12px] text-ink-soft border-b border-line">
          평가 점수를 의미 있는 관계 유형으로 변환하는 규칙입니다. 점수 구간에 따라 관계 종류와 가중치가 결정됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                {['출처', '대상', '영역', '점수 구간', '관계 유형', '가중치', '방향'].map((h) => (
                  <th key={h} className="text-left text-[10px] text-ink-faint font-semibold uppercase tracking-[0.1em] px-4 py-2.5 first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--color-line)] last:border-0 hover:bg-fill-2 transition-colors">
                  <td className="px-4 py-2.5 first:pl-5 text-[12px] text-ink">{KIND_LABELS[r.source_kind] ?? r.source_kind}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink">{KIND_LABELS[r.target_kind] ?? r.target_kind}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-soft">{DIM_LABELS[r.dimension as Dim] ?? r.dimension}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-soft tabular-nums">{r.score_min} ~ {r.score_max}</td>
                  <td className="px-4 py-2.5"><Badge className="text-[#58A6FF] bg-[rgba(88,166,255,0.14)]">{RELATION_LABELS[r.relation_type] ?? r.relation_type}</Badge></td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-soft tabular-nums">{Number(r.weight).toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-faint">{r.is_directed ? '방향성' : '양방향'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
