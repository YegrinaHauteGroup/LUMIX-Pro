'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import {
  ACTIVITY_STATUS_COLORS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_TYPE_LABELS,
  CHILD_STATUS_COLORS,
  CHILD_STATUS_LABELS,
  GENDER_LABELS,
  calculateAge,
  formatDate,
} from '@/lib/utils'
import type { Activity, Child, Class } from '@/lib/types'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  child: Child
  classes: Pick<Class, 'id' | 'name'>[]
  recentActivities: Activity[]
}

export function ChildDetailClient({ child, classes, recentActivities }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: child.name,
    birth_date: child.birth_date ?? '',
    gender: child.gender,
    class_id: child.class_id ?? '',
    status: child.status,
    guardian_name: child.guardian_name ?? '',
    guardian_phone: child.guardian_phone ?? '',
    notes: child.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    const { data, error } = await supabase
      .from('children')
      .update({
        name: form.name,
        birth_date: form.birth_date || null,
        gender: form.gender,
        class_id: form.class_id || null,
        status: form.status,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        notes: form.notes || null,
      })
      .eq('id', child.id)
      .select('id')

    setSaving(false)
    if (error) { setSaveError(`저장 실패: ${error.message}`); return }
    if (!data || data.length === 0) {
      setSaveError('저장 권한이 없거나 대상을 찾을 수 없습니다. (센터 권한을 확인하세요)')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className="flex-1 p-6 space-y-5">
      <Link
        href="/children"
        className="inline-flex items-center gap-1.5 text-sm text-[#667085] hover:text-[#475467] transition-colors"
      >
        <ArrowLeft size={14} />
        아동 목록으로
      </Link>

      <div className="grid grid-cols-3 gap-5">
        {/* Profile card */}
        <Card className="col-span-1">
          <CardContent className="pt-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 bg-[#f1f4f9] border border-[#e6eaf2] flex items-center justify-center">
                <span className="text-2xl font-semibold text-[#5a6678]">{child.name[0]}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">{child.name}</h2>
                <p className="text-sm text-[#7a8499]">
                  {child.birth_date ? `${calculateAge(child.birth_date)}세` : '나이 미등록'}
                  {' · '}
                  {GENDER_LABELS[child.gender]}
                </p>
              </div>
              <Badge className={CHILD_STATUS_COLORS[child.status]}>
                {CHILD_STATUS_LABELS[child.status]}
              </Badge>
            </div>

            <div className="mt-5 space-y-3 border-t border-[#e9edf4] pt-4">
              <div>
                <p className="text-xs text-[#7a8499] mb-0.5">소속 반</p>
                <p className="text-sm text-[#0e1726]">
                  {(child.classes as Class | undefined)?.name ?? '미배정'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#7a8499] mb-0.5">보호자</p>
                <p className="text-sm text-[#0e1726]">{child.guardian_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#7a8499] mb-0.5">연락처</p>
                <p className="text-sm text-[#0e1726]">{child.guardian_phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#7a8499] mb-0.5">등록일</p>
                <p className="text-sm text-[#0e1726]">{formatDate(child.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>정보 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="이름 *"
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
                  <option value="">반 미배정</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="보호자 이름"
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                />
                <Input
                  label="보호자 연락처"
                  value={form.guardian_phone}
                  onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                />
              </div>
              <Select
                label="재원 상태"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Child['status'] })}
              >
                <option value="active">재원</option>
                <option value="leave">휴원</option>
                <option value="inactive">퇴원</option>
              </Select>
              <Textarea
                label="메모"
                rows={3}
                placeholder="특이사항, 주의사항 등을 입력하세요"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              {saveError && (
                <div className="border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] rounded-lg px-3 py-2 text-[12px] text-danger">
                  {saveError}
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  <Save size={14} />
                  {saved ? '저장됨' : '저장'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Recent activities */}
      <Card>
        <CardHeader>
          <CardTitle>참여 활동</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-[#8a93a6] py-4 text-center">참여한 활동이 없습니다</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentActivities.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#f1f4f9] border border-[#e6eaf2]"
                >
                  <div className={`w-1.5 h-8 rounded-full ${ACTIVITY_TYPE_COLORS[activity.type]?.split(' ')[1]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0e1726] font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-[#7a8499]">{activity.activity_date ?? '날짜 미정'}</p>
                  </div>
                  <Badge className={ACTIVITY_STATUS_COLORS[activity.status]}>
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
