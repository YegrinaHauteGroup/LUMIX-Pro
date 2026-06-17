'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import { Lock, Mail } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-10 h-10 text-[#e8e8e8]">
            <Image src="/logo.svg" alt="LUMIX Pro" width={40} height={40} />
          </div>
          <div className="text-center">
            <p className="text-[16px] font-semibold text-[#e8e8e8] tracking-[0.15em]">LUMIX Pro</p>
            <p className="text-[11px] text-[#444444] tracking-widest mt-0.5 uppercase">아동 시설 관리 플랫폼</p>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-[#0e0e0e] border border-[#1e1e1e] p-6">
          <p className="text-[11px] text-[#444444] uppercase tracking-widest mb-5">관리자 로그인</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              label="이메일"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={<Mail size={12} />}
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock size={12} />}
            />
            {error && (
              <div className="border border-[#3a1414] bg-[#120808] px-3 py-2">
                <p className="text-[11px] text-[#ef4444]">{error}</p>
              </div>
            )}
            <div className="pt-1">
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                로그인
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-[#2a2a2a] mt-5 tracking-wider uppercase">
          © 2026 LUMIX Pro · All rights reserved
        </p>
      </div>
    </div>
  )
}
