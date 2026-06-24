'use client'

import { LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-surface/80 backdrop-blur-md border-b border-line flex items-center px-5 gap-4 sticky top-0 z-20 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <h1 className="text-[15px] font-semibold text-ink tracking-[-0.015em] truncate">{title}</h1>
        {subtitle && (
          <>
            <span className="text-line-strong">/</span>
            <span className="text-[12.5px] text-ink-faint truncate">{subtitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={handleLogout}
          title="로그아웃"
          className="flex items-center gap-1.5 px-3 h-8 text-[12px] text-ink-soft hover:text-ink bg-surface hover:bg-fill border border-line hover:border-line-strong transition-colors rounded-lg"
        >
          <LogOut size={13} />
          로그아웃
        </button>
        <div className="w-8 h-8 bg-accent-soft border border-line rounded-full flex items-center justify-center ml-0.5">
          <User size={14} className="text-accent" />
        </div>
      </div>
    </header>
  )
}
