'use client'

import { cn } from '@/lib/utils'
import {
  BarChart3, BookOpen, CalendarDays, ClipboardList,
  Home, Network, Settings, Users,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
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
    <aside className="w-[200px] h-screen bg-[#080808] border-r border-[#1a1a1a] flex flex-col fixed left-0 top-0 z-30 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1a1a1a]">
        <div className="w-6 h-6 text-[#e8e8e8] shrink-0">
          <Image src="/logo.svg" alt="LUMIX Pro" width={24} height={24} />
        </div>
        <div className="leading-none">
          <span className="text-[13px] font-semibold text-[#e8e8e8] tracking-wider">LUMIX</span>
          <span className="text-[13px] font-semibold text-[#555555] tracking-wider ml-1">Pro</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors relative group',
                active
                  ? 'text-[#e8e8e8] bg-[#141414]'
                  : 'text-[#555555] hover:text-[#888888] hover:bg-[#0e0e0e]'
              )}
            >
              {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#e8e8e8]" />
              )}
              <Icon size={14} className="shrink-0" />
              <span className="tracking-wide">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="border-t border-[#1a1a1a] py-2">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors relative',
            pathname === '/settings'
              ? 'text-[#e8e8e8] bg-[#141414]'
              : 'text-[#555555] hover:text-[#888888] hover:bg-[#0e0e0e]'
          )}
        >
          {pathname === '/settings' && (
            <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#e8e8e8]" />
          )}
          <Settings size={14} className="shrink-0" />
          <span className="tracking-wide">설정</span>
        </Link>
      </div>
    </aside>
  )
}
