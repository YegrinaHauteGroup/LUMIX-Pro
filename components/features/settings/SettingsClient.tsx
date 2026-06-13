'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Building2, KeyRound, Shield, User as UserIcon } from 'lucide-react'
import { useState } from 'react'

interface Props {
  user: User | null
}

export function SettingsClient({ user }: Props) {
  const supabase = createClient()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      setPwMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' })
      return
    }
    if (newPw.length < 8) {
      setPwMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다.' })
      return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      setPwMessage({ type: 'error', text: error.message })
    } else {
      setPwMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
  }

  return (
    <div className="flex-1 p-6 max-w-2xl space-y-5">
      {/* Account info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon size={15} className="text-[#555555]" />
            <CardTitle>계정 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-[#555555] mb-1">이메일</p>
            <p className="text-sm text-[#e0e0e0] bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-2">
              {user?.email ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#555555] mb-1">계정 ID</p>
            <p className="text-sm text-[#555555] bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-2 font-mono text-xs">
              {user?.id ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#555555] mb-1">마지막 로그인</p>
            <p className="text-sm text-[#a0a0a0] bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-2">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString('ko-KR')
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-[#555555]" />
            <CardTitle>비밀번호 변경</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <Input
              label="새 비밀번호"
              type="password"
              placeholder="8자 이상"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Input
              label="새 비밀번호 확인"
              type="password"
              placeholder="비밀번호 재입력"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
            {pwMessage && (
              <div className={`px-3 py-2 rounded-lg text-xs ${
                pwMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {pwMessage.text}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={pwLoading}>
                변경하기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* System info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-[#555555]" />
            <CardTitle>시스템 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: '플랫폼', value: 'LUMIX Pro' },
            { label: '버전', value: 'v1.0.0' },
            { label: 'DB', value: 'Supabase (PostgreSQL)' },
            { label: '지원', value: 'support@lumixpro.kr' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#111111] last:border-0">
              <span className="text-xs text-[#555555]">{label}</span>
              <span className="text-xs text-[#a0a0a0]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
