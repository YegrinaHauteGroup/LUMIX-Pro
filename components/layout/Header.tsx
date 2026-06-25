'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bug, ChevronRight, History, LogOut, Search } from 'lucide-react'
import { ACTION_LABELS, TABLE_LABELS, auditTablesFor, resolveBreadcrumb } from '@/lib/nav'

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

interface ChildHit { id: string; name: string; classes: { name: string } | null }
interface AuditRow { action: string; target_table: string; occurred_at: string; actor_staff_id: string | null }

export function Header({ subtitle, actions }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const crumb = useMemo(() => resolveBreadcrumb(pathname), [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // ----- quick search (children) -----
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ChildHit[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    if (q.trim().length < 1) { setHits([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('children').select('id, name, classes(name)')
        .ilike('name', `%${q.trim()}%`).is('deleted_at', null).limit(6)
      setHits((data as unknown as ChildHit[]) ?? [])
      setSearchOpen(true)
    }, 220)
    return () => clearTimeout(t)
  }, [q, supabase])

  // ----- data history (audit_logs) -----
  const [histOpen, setHistOpen] = useState(false)
  const [history, setHistory] = useState<AuditRow[] | null>(null)
  const [staffMap, setStaffMap] = useState<Record<string, string>>({})
  async function loadHistory() {
    const tables = auditTablesFor(pathname)
    let query = supabase.from('audit_logs')
      .select('action, target_table, occurred_at, actor_staff_id')
      .order('occurred_at', { ascending: false }).limit(25)
    if (tables.length) query = query.in('target_table', tables)
    const [{ data: logs }, { data: staff }] = await Promise.all([
      query,
      supabase.from('staff_profiles').select('id, name').is('deleted_at', null),
    ])
    const sm: Record<string, string> = {}
    ;(staff ?? []).forEach((s: { id: string; name: string }) => { sm[s.id] = s.name })
    setStaffMap(sm)
    setHistory((logs as AuditRow[]) ?? [])
  }
  function toggleHistory() {
    const next = !histOpen; setHistOpen(next); setSearchOpen(false)
    if (next) loadHistory()
  }

  // close popovers on outside click
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setSearchOpen(false); setHistOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const rel = (iso: string) => {
    const d = (Date.now() - new Date(iso).getTime()) / 1000
    if (d < 60) return '방금'
    if (d < 3600) return `${Math.floor(d / 60)}분 전`
    if (d < 86400) return `${Math.floor(d / 3600)}시간 전`
    return `${Math.floor(d / 86400)}일 전`
  }

  return (
    <header className="h-12 bg-surface border-b border-line flex items-center px-4 gap-4 sticky top-0 z-30 shrink-0">
      {/* breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] text-ink-faint truncate">{crumb.group}</span>
        {crumb.page && <ChevronRight size={13} className="text-ink-ghost shrink-0" />}
        {crumb.page && <span className="text-[13px] font-semibold text-ink tracking-[-0.01em] truncate">{crumb.page}</span>}
        {subtitle && <span className="hidden lg:inline text-[11px] text-ink-ghost truncate ml-1.5">· {subtitle}</span>}
      </div>

      <div className="flex-1" />

      <div ref={wrapRef} className="flex items-center gap-1.5">
        {actions}

        {/* search */}
        <div className="relative">
          <div className="flex items-center h-8 w-[200px] bg-fill border border-line rounded-lg px-2.5 focus-within:border-accent transition-colors">
            <Search size={13} className="text-ink-faint shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => q && setSearchOpen(true)}
              placeholder="아동 검색"
              className="flex-1 min-w-0 bg-transparent pl-2 text-[12px] text-ink placeholder-ink-ghost focus:outline-none" />
          </div>
          {searchOpen && hits.length > 0 && (
            <div className="absolute right-0 mt-1.5 w-[240px] bg-surface border border-line rounded-lg shadow-[var(--shadow-pop)] py-1 z-40">
              {hits.map((h) => (
                <Link key={h.id} href={`/children/${h.id}`} onClick={() => { setSearchOpen(false); setQ('') }}
                  className="flex items-center justify-between px-3 py-2 hover:bg-fill transition-colors">
                  <span className="text-[12.5px] text-ink">{h.name}</span>
                  <span className="text-[11px] text-ink-faint">{h.classes?.name ?? '미배정'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* data history */}
        <div className="relative">
          <button onClick={toggleHistory} title="데이터 변경 이력"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-fill border border-line transition-colors">
            <History size={14} />
          </button>
          {histOpen && (
            <div className="absolute right-0 mt-1.5 w-[320px] bg-surface border border-line rounded-lg shadow-[var(--shadow-pop)] z-40 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-line">
                <p className="text-[12px] font-semibold text-ink">데이터 변경 이력</p>
                <p className="text-[10.5px] text-ink-faint mt-0.5">{crumb.page || '전체'} · 시설 관리자 편집 기록</p>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {history == null ? (
                  <p className="text-[12px] text-ink-faint px-3.5 py-4">불러오는 중…</p>
                ) : history.length === 0 ? (
                  <p className="text-[12px] text-ink-faint px-3.5 py-4">기록된 변경 이력이 없습니다.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-line last:border-0">
                      <div className="min-w-0">
                        <p className="text-[12px] text-ink truncate">
                          <span className="font-medium">{h.actor_staff_id ? staffMap[h.actor_staff_id] ?? '관리자' : '시스템'}</span>
                          <span className="text-ink-faint"> · {TABLE_LABELS[h.target_table] ?? h.target_table} {ACTION_LABELS[h.action] ?? h.action}</span>
                        </p>
                      </div>
                      <span className="text-[10.5px] text-ink-ghost shrink-0">{rel(h.occurred_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* bug report */}
        <a href="https://www.officialyegrina.com" target="_blank" rel="noreferrer" title="버그 문의"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-fill border border-line transition-colors">
          <Bug size={14} />
        </a>

        {/* logout */}
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 h-8 text-[12px] text-ink-soft hover:text-ink bg-surface hover:bg-fill border border-line transition-colors rounded-lg">
          <LogOut size={13} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
