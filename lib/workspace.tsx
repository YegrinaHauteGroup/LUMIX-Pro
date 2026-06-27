'use client'

import { createClient } from '@/utils/supabase/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// ── Workspace item model ────────────────────────────────────────────────────
export interface InfoField { label: string; value: string }
export interface WorkspaceInfoItem {
  id: string
  kind: 'info'
  source: string            // origin module, e.g. 'SNA' · '파이프라인' · '아동' · '작전지도'
  title: string
  subtitle?: string
  fields?: InfoField[]
  href?: string             // link back to the origin
  accent?: string           // hex accent
  createdAt: number
}
export interface WorkspaceMemoItem {
  id: string
  kind: 'memo'
  title: string
  body: string
  mentions: string[]
  expanded?: boolean
  integrated?: boolean
  createdAt: number
}
export type WorkspaceItem = WorkspaceInfoItem | WorkspaceMemoItem

export interface ChildRef { id: string; name: string }

interface WorkspaceCtx {
  items: WorkspaceItem[]
  open: boolean
  setOpen: (b: boolean) => void
  query: string
  setQuery: (s: string) => void
  busy: boolean
  childList: ChildRef[]
  addInfo: (i: Omit<WorkspaceInfoItem, 'id' | 'kind' | 'createdAt'>) => void
  addMemo: (init?: Partial<WorkspaceMemoItem>) => void
  updateItem: (id: string, patch: Partial<WorkspaceItem>) => void
  remove: (id: string) => void
  clearAll: () => void
  integrate: (id?: string) => Promise<void>
  loadSaved: () => Promise<void>
}

const Ctx = createContext<WorkspaceCtx | null>(null)
const LS_KEY = 'lumix_ws_v1'
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** Clear persisted workspace state (call on logout). */
export function clearWorkspaceStorage() {
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [childList, setChildList] = useState<ChildRef[]>([])
  const hydrated = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  // hydrate from localStorage once (survives navigation AND reload)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) { const p = JSON.parse(raw); setItems(p.items ?? []); setOpen(!!p.open) }
    } catch { /* ignore */ }
    hydrated.current = true
  }, [])

  // persist
  useEffect(() => {
    if (!hydrated.current) return
    try { localStorage.setItem(LS_KEY, JSON.stringify({ items, open })) } catch { /* ignore */ }
  }, [items, open])

  // expose the panel width to fixed drawers so they open to its left
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--workspace-w', open ? 'clamp(280px, 20vw, 360px)' : '40px')
    return () => { root.style.setProperty('--workspace-w', '0px') }
  }, [open])

  // children for @mentions (RLS scopes to the active center)
  useEffect(() => {
    let alive = true
    supabase.from('children').select('id, name').eq('status', 'active').is('deleted_at', null).limit(800)
      .then(({ data }) => { if (alive && data) setChildList(data as ChildRef[]) })
    return () => { alive = false }
  }, [supabase])

  const addInfo = useCallback((i: Omit<WorkspaceInfoItem, 'id' | 'kind' | 'createdAt'>) => {
    setItems((cur) => [{ ...i, id: uid(), kind: 'info', createdAt: Date.now() }, ...cur])
    setOpen(true)
  }, [])

  const addMemo = useCallback((init?: Partial<WorkspaceMemoItem>) => {
    setItems((cur) => [{ id: uid(), kind: 'memo', title: init?.title ?? '', body: init?.body ?? '', mentions: init?.mentions ?? [], createdAt: Date.now(), ...init }, ...cur])
    setOpen(true)
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<WorkspaceItem>) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } as WorkspaceItem : it)))
  }, [])

  const remove = useCallback((id: string) => setItems((cur) => cur.filter((it) => it.id !== id)), [])
  const clearAll = useCallback(() => setItems([]), [])

  // integrate memo(s) into facility data via the workspace API
  const integrate = useCallback(async (id?: string) => {
    const memos = items.filter((it): it is WorkspaceMemoItem => it.kind === 'memo' && (id ? it.id === id : true) && (it.body.trim() !== '' || (it.title ?? '').trim() !== ''))
    if (memos.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memos: memos.map((m) => ({ title: m.title, body: m.body, mentions: m.mentions, source: 'workspace' })) }),
      })
      if (res.ok) setItems((cur) => cur.map((it) => (memos.find((m) => m.id === it.id) ? { ...it, integrated: true } as WorkspaceItem : it)))
    } catch { /* ignore */ } finally { setBusy(false) }
  }, [items])

  const loadSaved = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/workspace', { method: 'GET' })
      if (res.ok) {
        const { memos } = await res.json()
        const loaded: WorkspaceItem[] = (memos ?? []).map((m: any) => ({
          id: uid(), kind: 'memo', title: m.title ?? '', body: m.body ?? '',
          mentions: Array.isArray(m.mentions) ? m.mentions : [], integrated: true, createdAt: Date.now(),
        }))
        if (loaded.length) { setItems((cur) => [...loaded, ...cur]); setOpen(true) }
      }
    } catch { /* ignore */ } finally { setBusy(false) }
  }, [])

  const value: WorkspaceCtx = {
    items, open, setOpen, query, setQuery, busy, childList,
    addInfo, addMemo, updateItem, remove, clearAll, integrate, loadSaved,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return c
}

/** Safe variant for components that may render outside the provider. */
export function useWorkspaceOptional() {
  return useContext(Ctx)
}
