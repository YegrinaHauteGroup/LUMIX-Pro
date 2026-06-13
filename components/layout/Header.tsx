'use client'

import { Bell, LogOut, Search, User } from 'lucide-react'
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
  }

  return (
    <header className="h-14 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center px-6 gap-4 sticky top-0 z-20">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-[#f5f5f5] truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[#666666] truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#555555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a] transition-colors">
          <Search size={15} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#555555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a] transition-colors relative">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        </button>
        <div className="w-px h-4 bg-[#1e1e1e] mx-1" />
        <button
          onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#555555] hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="로그아웃"
        >
          <LogOut size={15} />
        </button>
        <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
          <User size={13} className="text-indigo-400" />
        </div>
      </div>
    </header>
  )
}
