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
    <header className="h-12 bg-[#080808] border-b border-[#1a1a1a] flex items-center px-6 gap-4 sticky top-0 z-20 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <h1 className="text-[13px] font-semibold text-[#e8e8e8] tracking-wide truncate">{title}</h1>
        {subtitle && (
          <>
            <span className="text-[#2a2a2a]">/</span>
            <span className="text-[12px] text-[#444444] truncate">{subtitle}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <button
          onClick={handleLogout}
          title="로그아웃"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#444444] hover:text-[#888888] hover:bg-[#111111] border border-transparent hover:border-[#222222] transition-colors rounded-sm"
        >
          <LogOut size={12} />
          로그아웃
        </button>
        <div className="w-6 h-6 bg-[#141414] border border-[#222222] flex items-center justify-center ml-1">
          <User size={12} className="text-[#555555]" />
        </div>
      </div>
    </header>
  )
}
