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
    <div className="relative min-h-screen bg-canvas flex items-center justify-center p-4 overflow-hidden">
      {/* Pastel ambient glow */}
      <div className="pointer-events-none absolute -top-40 -right-32 w-[34rem] h-[34rem] rounded-full bg-accent-soft blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 w-[30rem] h-[30rem] rounded-full bg-[color:var(--color-info-soft)] blur-3xl opacity-70" />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.5] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#0e172608 1px, transparent 1px), linear-gradient(90deg, #0e172608 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
        }}
      />

      <div className="relative w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-7 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] flex items-center justify-center">
            <Image src="/logo.svg" alt="LUMIX Pro" width={28} height={28} />
          </div>
          <div className="text-center">
            <p className="text-[18px] font-semibold text-ink tracking-[-0.01em]">LUMIX Pro</p>
            <p className="text-[11px] text-ink-faint tracking-[0.12em] mt-1 uppercase">아동 시설 관리 플랫폼</p>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-surface border border-line rounded-2xl shadow-[var(--shadow-pop)] p-7">
          <p className="text-[11px] text-ink-faint uppercase tracking-[0.12em] mb-5">관리자 로그인</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="이메일"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={<Mail size={13} />}
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock size={13} />}
            />
            {error && (
              <div className="border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-danger">{error}</p>
              </div>
            )}
            <div className="pt-1">
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                로그인
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-ink-ghost mt-6 tracking-[0.1em] uppercase">
          © 2026 LUMIX Pro · All rights reserved
        </p>
      </div>
    </div>
  )
}
