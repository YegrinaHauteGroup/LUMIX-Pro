'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import type { CenterInfo } from '@/lib/center'
import type { User } from '@supabase/supabase-js'
import { Building2, KeyRound, Shield, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

interface Props {
  user: User | null
  center: CenterInfo | null
}

export function SettingsClient({ user, center }: Props) {
  const supabase = createClient()

  // Center name
  const [centerName, setCenterName] = useState(center?.name ?? '')
  const [centerAddress, setCenterAddress] = useState('')
  const [centerPhone, setCenterPhone] = useState('')
  const [centerLoading, setCenterLoading] = useState(false)
  const [centerMsg, setCenterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleCenterSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!center?.id) { setCenterMsg({ type: 'error', text: '센터 정보를 찾을 수 없습니다.' }); return }
    if (!centerName.trim()) { setCenterMsg({ type: 'error', text: '시설 이름을 입력해주세요.' }); return }
    setCenterLoading(true)
    const { error } = await supabase.from('centers').update({ name: centerName.trim() }).eq('id', center.id)
    setCenterLoading(false)
    setCenterMsg(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: '시설 정보가 저장되었습니다.' }
    )
    setTimeout(() => setCenterMsg(null), 3000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' }); return }
    if (newPw.length < 8) { setPwMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다.' }); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMessage({ type: 'error', text: error.message })
    } else {
      setPwMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' })
      setNewPw(''); setConfirmPw('')
    }
  }

  return (
    <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-6 overflow-auto">

      {/* Center info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-[#8a93a6]" />
            <CardTitle>시설 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!center ? (
            <div className="border border-[#fdf3e2] bg-[#120e00] px-3 py-3 text-[11px] text-[#b7791f] mb-3">
              센터 정보가 없습니다. 저장 버튼을 클릭하면 자동으로 생성됩니다.
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-[10px] text-[#aab2c2] uppercase tracking-widest mb-1">센터 ID</p>
              <p className="text-[11px] text-[#aab2c2] font-mono">{center.id}</p>
            </div>
          )}
          <form onSubmit={handleCenterSave} className="space-y-3">
            <Input
              label="시설 이름 *"
              placeholder="예: 햇살 아동 센터"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              required
            />
            {centerMsg && (
              <div className={`px-3 py-3 text-[11px] ${
                centerMsg.type === 'success'
                  ? 'border border-[#e7f7ed] bg-[#e7f7ed] text-emerald-500'
                  : 'border border-[#f7caca] bg-[#fdecec] text-red-400'
              }`}>
                {centerMsg.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={centerLoading}>저장</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon size={13} className="text-[#8a93a6]" />
            <CardTitle>계정 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">이메일</p>
            <p className="text-[12px] text-[#1c2740] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3">
              {user?.email ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">계정 ID</p>
            <p className="text-[11px] text-[#8a93a6] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3 font-mono">
              {user?.id ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#8a93a6] uppercase tracking-widest mb-1">마지막 로그인</p>
            <p className="text-[12px] text-[#5a6678] bg-[#f1f4f9] border border-[#e6eaf2] px-3 py-3">
              {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ko-KR') : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound size={13} className="text-[#8a93a6]" />
            <CardTitle>비밀번호 변경</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <Input label="새 비밀번호" type="password" placeholder="8자 이상"
              value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <Input label="새 비밀번호 확인" type="password" placeholder="비밀번호 재입력"
              value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            {pwMessage && (
              <div className={`px-3 py-3 text-[11px] ${
                pwMessage.type === 'success'
                  ? 'border border-[#e7f7ed] bg-[#e7f7ed] text-emerald-500'
                  : 'border border-[#f7caca] bg-[#fdecec] text-red-400'
              }`}>
                {pwMessage.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={pwLoading}>변경하기</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* System info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-[#8a93a6]" />
            <CardTitle>시스템 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            { label: '플랫폼', value: 'LUMIX Pro' },
            { label: '버전', value: 'v1.0.0' },
            { label: 'DB', value: 'Supabase (PostgreSQL)' },
            { label: '지원', value: 'support@lumixpro.kr' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-[#eef2f8] last:border-0">
              <span className="text-[11px] text-[#8a93a6] uppercase tracking-widest">{label}</span>
              <span className="text-[11px] text-[#5a6678]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
