'use client'
/* 그대는 세상을 바꾸기 위하여 어떤 노력을 했는가? - 민재 김,
2026년 6월 24일 오후 11시 05분.
해당 이스터에그는 SW TF팀에게 강요하여 작성됨 */
import { cn } from '@/lib/utils'
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from '@/lib/nav'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export function Sidebar({ centerName }: { centerName?: string | null }) {
  const pathname = usePathname()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
    return (
      <Link href={item.href} title={item.label}
        className={cn(
          'flex items-center h-9 mx-2 rounded-[3px] transition-colors group/link',
          open ? 'px-2.5 gap-3' : 'px-0 justify-center',
          active ? 'bg-accent-soft text-accent-ink font-medium' : 'text-ink-soft hover:text-ink hover:bg-fill',
        )}>
        <Icon size={17} className={cn('shrink-0 transition-colors', active ? 'text-accent' : 'text-ink-faint group-hover/link:text-ink-soft')} />
        <span className={cn('text-[13px] tracking-tight whitespace-nowrap transition-opacity duration-150', open ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>{item.label}</span>
      </Link>
    )
  }

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'fixed left-0 top-0 h-screen z-40 bg-surface border-r border-line flex flex-col transition-[width] duration-200 ease-out overflow-hidden',
        open ? 'w-[224px] shadow-[var(--shadow-pop)]' : 'w-[56px]',
      )}
    >
      {/* Logo / brand — click to pin open */}
      <button onClick={() => setPinned((p) => !p)} title={pinned ? '사이드바 고정 해제' : '사이드바 고정'}
        className={cn('flex items-center h-12 shrink-0 border-b border-line/70', open ? 'px-4 gap-2.5' : 'px-0 justify-center')}>
        <Image src="/logo.svg" alt="LUMIX Pro" width={22} height={22} className="shrink-0" />
        <span className={cn('leading-none flex items-baseline transition-opacity duration-150', open ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden')}>
          <span className="text-[15px] font-bold text-ink tracking-tight">LUMIX</span>
          <span className="text-[15px] font-medium text-ink-ghost tracking-tight ml-1">Pro</span>
        </span>
      </button>

      {/* Active center (expanded only) */}
      {open && centerName && (
        <div className="px-4 py-3 border-b border-line/60">
          <p className="text-[10px] font-semibold text-ink-ghost uppercase tracking-widest mb-1.5">센터 정보</p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <p className="text-[13px] font-medium text-ink truncate">{centerName}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-4 no-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className={cn('px-4 mb-1 text-[10px] font-semibold text-ink-ghost uppercase tracking-wider transition-opacity duration-150',
              open ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden')}>{group.label}</p>
            {group.items.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-line/60 mt-auto">
        <NavLink item={SETTINGS_ITEM} />
      </div>
    </aside>
  )
}
