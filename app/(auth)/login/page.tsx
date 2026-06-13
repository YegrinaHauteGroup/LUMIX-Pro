'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import { Lock, Mail } from 'lucide-react'
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div className="text-left">
              <div className="text-[#f5f5f5] font-bold text-xl tracking-wide leading-none">
                LUMIX<span className="text-indigo-400 ml-1">Pro</span>
              </div>
              <div className="text-[#555555] text-xs mt-0.5">아동 시설 관리 플랫폼</div>
            </div>
          </div>
          <p className="text-[#555555] text-sm">관리자 계정으로 로그인하세요</p>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="이메일"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              icon={<Mail size={14} />}
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={<Lock size={14} />}
            />

            {error && (
              <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              로그인
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-[#1e1e1e] text-center">
            <p className="text-xs text-[#444444]">
              계정 문의:{' '}
              <a href="mailto:support@lumixpro.kr" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                support@lumixpro.kr
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-[#333333] text-xs mt-6">
          © 2026 LUMIX Pro. All rights reserved.
        </p>
      </div>
    </div>
  )
}
