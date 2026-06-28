'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bug, ChevronRight, History, LogOut, Search } from 'lucide-react'
import { ACTION_LABELS, TABLE_LABELS, auditTablesFor, resolveBreadcrumb } from '@/lib/nav'
import { clearWorkspaceStorage } from '@/lib/workspace'
import { HeaderTools } from './HeaderTools'

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

interface SearchHit { kind: string; id: string; label: string; sublabel: string; href: string }
interface AuditRow { action: string; target_table: string; occurred_at: string; actor_staff_id: string | null }

export function Header({ subtitle, actions }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const crumb = useMemo(() => resolveBreadcrumb(pathname), [pathname])

  const handleLogout = async () => {
    clearWorkspaceStorage()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // ----- global omni-search (all objects/events) -----
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    if (q.trim().length < 1) { setHits([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('global_search', { p_q: q.trim() })
      setHits((data as SearchHit[]) ?? [])
      setSearching(false)
      setSearchOpen(true)
    }, 220)
    return () => clearTimeout(t)
  }, [q, supabase])

  const KIND_COLOR: Record<string, string> = {
    아동: '#137cbd', 반: '#0f9960', 활동: '#d9822b', 교직원: '#8b5cf6',
    보호자: '#fb7185', 'SNA 노드': '#06b6d4', 퀘스트: '#eab308', 기록: '#5c7080',
  }

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
        <span className="text-[12px] text-ink truncate">{crumb.group}</span>
        {crumb.page && <ChevronRight size={13} className="text-ink-ghost shrink-0" />}
        {crumb.page && <span className="text-[13px] font-semibold text-ink tracking-[-0.01em] truncate">{crumb.page}</span>}
        {subtitle && <span className="hidden lg:inline text-[11px] text-ink-soft truncate ml-1.5">· {subtitle}</span>}
      </div>

      <div className="flex-1" />
      <HeaderTools />
      <div className="flex-1" />

      <div ref={wrapRef} className="flex items-center gap-1.5">
        {actions}

        {/* global search */}
        <div className="relative">
          <div className="flex items-center h-8 w-[260px] bg-fill border border-line rounded-[3px] px-2.5 focus-within:border-accent transition-colors">
            <Search size={13} className="text-ink-faint shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => q && setSearchOpen(true)}
              placeholder="객체·온톨로지·데이터 통합 검색…"
              className="flex-1 min-w-0 bg-transparent pl-2 text-[12px] text-ink placeholder-ink-ghost focus:outline-none" />
          </div>
          {searchOpen && q.trim() && (
            <div className="absolute right-0 mt-1.5 w-[320px] max-h-[420px] overflow-y-auto bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] py-1 z-40">
              {searching ? (
                <p className="text-[12px] text-ink-faint px-3 py-3">검색 중…</p>
              ) : hits.length === 0 ? (
                <p className="text-[12px] text-ink-faint px-3 py-3">검색 결과가 없습니다.</p>
              ) : (
                hits.map((h) => (
                  <Link key={`${h.kind}-${h.id}`} href={h.href} onClick={() => { setSearchOpen(false); setQ('') }}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-fill transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_COLOR[h.kind] ?? '#8a9ba8' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-ink truncate">{h.label}</p>
                      <p className="text-[10.5px] text-ink-faint truncate">{h.sublabel}</p>
                    </div>
                    <span className="text-[10px] text-ink-ghost shrink-0">{h.kind}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* data history */}
        <div className="relative">
          <button onClick={toggleHistory} title="데이터 변경 이력"
            className="w-8 h-8 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-ink hover:bg-fill border border-line transition-colors">
            <History size={14} />
          </button>
          {histOpen && (
            <div className="absolute right-0 mt-1.5 w-[320px] bg-surface border border-line rounded-[3px] shadow-[var(--shadow-pop)] z-40 overflow-hidden">
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
          className="w-8 h-8 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-ink hover:bg-fill border border-line transition-colors">
          <Bug size={14} />
        </a>

        {/* logout */}
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 h-8 text-[12px] text-ink-soft hover:text-ink bg-surface hover:bg-fill border border-line transition-colors rounded-[3px]">
          <LogOut size={12} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
