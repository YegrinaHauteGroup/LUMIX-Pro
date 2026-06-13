'use client'

import { cn } from '@/lib/utils'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Home,
  Network,
  Settings,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: Home, label: '대시보드' },
  { href: '/children', icon: Users, label: '아동 관리' },
  { href: '/classes', icon: BookOpen, label: '반 관리' },
  { href: '/activities', icon: CalendarDays, label: '활동 관리' },
  { href: '/attendance', icon: ClipboardList, label: '출석 관리' },
  { href: '/sna', icon: Network, label: 'SNA 분석' },
  { href: '/reports', icon: BarChart3, label: '보고서' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 h-screen bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col shrink-0 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <div>
            <span className="text-[#f5f5f5] font-semibold text-sm tracking-wide">LUMIX</span>
            <span className="text-indigo-400 font-semibold text-sm ml-1">Pro</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                active
                  ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                  : 'text-[#666666] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'
              )}
            >
              <Icon
                size={16}
                className={cn(
                  'shrink-0 transition-colors',
                  active ? 'text-indigo-400' : 'text-[#444444] group-hover:text-[#666666]'
                )}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="text-indigo-400/50" />}
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 py-3 border-t border-[#1a1a1a]">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
            pathname === '/settings'
              ? 'bg-indigo-600/15 text-indigo-400 font-medium'
              : 'text-[#666666] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]'
          )}
        >
          <Settings size={16} className="shrink-0 text-[#444444] group-hover:text-[#666666]" />
          <span>설정</span>
        </Link>
      </div>
    </aside>
  )
}
