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
    label: '운영체계',
    items: [
      { href: '/dashboard', icon: Home, label: '대시보드' },
      { href: '/children', icon: Users, label: '아동 관리' },
      { href: '/classes', icon: BookOpen, label: '반 관리' },
      { href: '/activities', icon: CalendarDays, label: '활동 관리' },
      { href: '/attendance', icon: ClipboardList, label: '출석 관리' },
    ],
  },
  {
    label: '분석체계',
    items: [
      { href: '/sna', icon: Network, label: 'SNA 분석' },
      { href: '/assessments', icon: ClipboardCheck, label: '평가 · 관계 입력' },
      { href: '/reports', icon: BarChart3, label: '보고서' },
    ],
  },
]

export function Sidebar({ centerName }: { centerName?: string | null }) {
  const pathname = usePathname()

  const NavLink = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 mx-3 px-3 py-2 rounded-md text-[13px] transition-colors group',
          active
            ? 'text-ink bg-fill font-medium' // Foundry 스타일: 은은한 배경과 명확한 텍스트 대비
            : 'text-ink-soft hover:text-ink hover:bg-fill/50'
        )}
      >
        <Icon 
          size={16} 
          className={cn(
            'shrink-0 transition-colors', 
            active ? 'text-accent' : 'text-ink-faint group-hover:text-ink-soft'
          )} 
        />
        <span className="tracking-tight">{label}</span>
      </Link>
    )
  }

  return (
    // 기존 w-[216px]에서 w-[200px]로 축소하여 슬림한 비율 완성
    <aside className="w-[200px] h-screen bg-surface border-r border-line flex flex-col fixed left-0 top-0 z-30 shrink-0">
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-6 h-16 shrink-0">
        <Image src="/logo.svg" alt="LUMIX Pro" width={22} height={22} className="shrink-0" />
        <div className="leading-none flex items-baseline">
          <span className="text-[15px] font-bold text-ink tracking-tight">LUMIX</span>
          <span className="text-[15px] font-medium text-ink-ghost tracking-tight ml-1">Pro</span>
        </div>
      </div>

      {/* Active center */}
      {centerName && (
        <div className="px-6 py-4 border-b border-line/60">
          <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-widest mb-1.5">현재 센터</p>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <p className="text-[13px] font-medium text-ink truncate leading-none mt-0.5">{centerName}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      {/* 그룹 간격을 space-y-4 에서 space-y-6 으로 늘려 여백 확보 */}
      <nav className="flex-1 py-6 overflow-y-auto space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-6 mb-2 text-[11px] font-medium text-ink-ghost uppercase tracking-wider">
              {group.label}
            </p>
            {group.items.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-line/60 mt-auto">
        <NavLink href="/settings" icon={Settings} label="설정" />
      </div>
    </aside>
  )
}
