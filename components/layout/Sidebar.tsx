'use client'

import { cn } from '@/lib/utils'
import {
  BarChart3, BookOpen, CalendarDays, ClipboardList,
  Home, Network, Settings, Users, ClipboardCheck,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_GROUPS: { label: string; items: { href: string; icon: typeof Home; label: string }[] }[] = [
  {
    label: '운영',
    items: [
      { href: '/dashboard', icon: Home, label: '대시보드' },
      { href: '/children', icon: Users, label: '아동 관리' },
      { href: '/classes', icon: BookOpen, label: '반 관리' },
      { href: '/activities', icon: CalendarDays, label: '활동 관리' },
      { href: '/attendance', icon: ClipboardList, label: '출석 관리' },
    ],
  },
  {
    label: '분석',
    items: [
      { href: '/sna', icon: Network, label: 'SNA 분석' },
      { href: '/assessments', icon: ClipboardCheck, label: '평가 · 관계 입력' },
      { href: '/reports', icon: BarChart3, label: '보고서' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[12.5px] transition-colors relative group',
          active
            ? 'text-accent-ink bg-accent-soft font-medium'
            : 'text-ink-soft hover:text-ink hover:bg-fill',
        )}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent shadow-[0_0_8px_rgba(90,99,242,0.55)]" />}
        <Icon size={15} className={cn('shrink-0', active ? 'text-accent' : 'text-ink-faint group-hover:text-ink-soft')} />
        <span className="tracking-[-0.01em]">{label}</span>
      </Link>
    )
  }

  return (
    <aside className="w-[216px] h-screen bg-surface border-r border-line flex flex-col fixed left-0 top-0 z-30 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-line">
        <Image src="/logo.svg" alt="LUMIX Pro" width={24} height={24} className="shrink-0" />
        <div className="leading-none">
          <span className="text-[14px] font-semibold text-ink tracking-[-0.01em]">LUMIX</span>
          <span className="text-[14px] font-semibold text-ink-ghost tracking-[-0.01em] ml-1">Pro</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-5 mb-1 text-[10px] font-semibold text-ink-ghost uppercase tracking-[0.14em]">{group.label}</p>
            {group.items.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t border-line py-2">
        <NavLink href="/settings" icon={Settings} label="설정" />
      </div>
    </aside>
  )
}
