'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/utils/supabase/client'
import { Building2, Lock, Mail, User } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Mode = 'login' | 'signup' | 'reset' | 'update'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [centerName, setCenterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // when the user opens the password-recovery link from their email, Supabase
  // emits PASSWORD_RECOVERY with a temporary session — switch to update mode
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setMode('update'); setError(''); setInfo('새 비밀번호를 입력하세요.') }
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` })
    setLoading(false)
    if (error) { setError(error.message); return }
    setInfo('비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 열어 새 비밀번호를 설정하세요.')
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setInfo('비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.')
    setPassword(''); setMode('login')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    // ensure the user has a center/profile (idempotent)
    await supabase.rpc('bootstrap_new_user', { p_center_name: null, p_display_name: null })
    router.push('/dashboard')
    router.refresh()
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    })
    if (error) { setError(error.message); setLoading(false); return }

    if (data.session) {
      // no email confirmation required -> bootstrap center + profile, go in
      const { error: bErr } = await supabase.rpc('bootstrap_new_user', {
        p_center_name: centerName, p_display_name: name,
      })
      setLoading(false)
      if (bErr) { setError(`센터 생성 실패: ${bErr.message}`); return }
      router.push('/dashboard')
      router.refresh()
    } else {
      setLoading(false)
      setInfo('확인 메일을 보냈습니다. 이메일 인증 후 로그인하면 센터가 자동 생성됩니다.')
      setMode('login')
    }
  }

  return (
    <div className="relative min-h-screen bg-canvas flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-32 w-[34rem] h-[34rem] rounded-full bg-accent-soft blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 w-[30rem] h-[30rem] rounded-full bg-[color:var(--color-info-soft)] blur-3xl opacity-70" />
      <div
        className="absolute inset-0 opacity-[0.5] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#0e172608 1px, transparent 1px), linear-gradient(90deg, #0e172608 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
        }}
      />

      <div className="relative w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-7 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] flex items-center justify-center">
            <Image src="/logo.svg" alt="LUMIX Pro" width={28} height={28} />
          </div>
          <div className="text-center">
            <p className="text-[18px] font-semibold text-ink tracking-[-0.01em]">LUMIX Pro</p>
            <p className="text-[11px] text-ink-faint tracking-[0.12em] mt-1 uppercase">아동 시설 관리 플랫폼</p>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl shadow-[var(--shadow-pop)] p-7">
          {/* mode tabs (hidden during password reset / update) */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex p-1 bg-fill rounded-xl border border-line mb-5">
              {(['login', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); setInfo('') }}
                  className={
                    'flex-1 h-8 rounded-lg text-[12.5px] font-medium transition-colors ' +
                    (mode === m ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:text-ink')
                  }
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
          )}
          {(mode === 'reset' || mode === 'update') && (
            <p className="text-[13px] font-semibold text-ink mb-4">{mode === 'reset' ? '비밀번호 재설정' : '새 비밀번호 설정'}</p>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : mode === 'reset' ? handleReset : handleUpdatePassword} className="space-y-4">
            {mode === 'signup' && (
              <>
                <Input label="이름" placeholder="홍길동" value={name}
                  onChange={(e) => setName(e.target.value)} required icon={<User size={13} />} />
                <Input label="센터 이름" placeholder="예: 햇살 어린이집" value={centerName}
                  onChange={(e) => setCenterName(e.target.value)} required icon={<Building2 size={13} />} />
              </>
            )}
            {mode !== 'update' && (
              <Input label="이메일" type="email" placeholder="admin@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required icon={<Mail size={13} />} />
            )}
            {mode !== 'reset' && (
              <Input label={mode === 'update' ? '새 비밀번호' : '비밀번호'} type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required icon={<Lock size={13} />} />
            )}
            {mode === 'login' && (
              <div className="-mt-1.5 text-right">
                <button type="button" onClick={() => { setMode('reset'); setError(''); setInfo('') }}
                  className="text-[11px] text-accent hover:text-accent-hover">비밀번호를 잊으셨나요?</button>
              </div>
            )}

            {error && (
              <div className="border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-danger">{error}</p>
              </div>
            )}
            {info && (
              <div className="border border-[color:var(--color-success-soft)] bg-[color:var(--color-success-soft)] rounded-lg px-3 py-2">
                <p className="text-[11px] text-[color:var(--color-success)]">{info}</p>
              </div>
            )}

            <div className="pt-1">
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입 및 센터 생성' : mode === 'reset' ? '재설정 메일 보내기' : '비밀번호 변경'}
              </Button>
            </div>
            {(mode === 'reset' || mode === 'update') && (
              <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }}
                className="w-full text-center text-[11px] text-ink-faint hover:text-ink">← 로그인으로 돌아가기</button>
            )}
          </form>
        </div>

        <p className="text-center text-[10px] text-ink-ghost mt-6 tracking-[0.1em] uppercase">
          © 2026 LUMIX Pro · All rights reserved
        </p>
      </div>
    </div>
  )
}
