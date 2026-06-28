'use client'

import { createClient } from '@/utils/supabase/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// ── Workspace item model ────────────────────────────────────────────────────
export interface InfoField { label: string; value: string }
interface BaseItem { id: string; createdAt: number }
export interface WorkspaceInfoItem extends BaseItem {
  kind: 'info'
  source: string            // origin module, e.g. 'SNA' · '파이프라인' · '아동' · '작전지도' · '대시보드'
  title: string
  subtitle?: string
  fields?: InfoField[]
  body?: string             // full self-contained snapshot (shown when expanded)
  href?: string             // optional link back to the origin
  accent?: string
  expanded?: boolean
}
export interface WorkspaceMemoItem extends BaseItem {
  kind: 'memo'
  title: string
  body: string
  mentions: string[]
  expanded?: boolean
  integrated?: boolean
}
export interface WorkspaceLinkItem extends BaseItem {
  kind: 'link'
  url: string
  title: string
  note?: string
  accent?: string
  expanded?: boolean
}
export interface WorkspaceFileItem extends BaseItem {
  kind: 'file'
  name: string
  mime: string
  dataUrl: string
  size: number
  expanded?: boolean
}
export type WorkspaceItem = WorkspaceInfoItem | WorkspaceMemoItem | WorkspaceLinkItem | WorkspaceFileItem

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
  addLink: (url: string, title?: string, note?: string, accent?: string) => void
  addFile: (file: File) => Promise<void>
  updateItem: (id: string, patch: Partial<WorkspaceItem>) => void
  remove: (id: string) => void
  clearAll: () => void
  integrate: (id?: string) => Promise<void>
  loadSaved: () => Promise<void>
}

const Ctx = createContext<WorkspaceCtx | null>(null)
const LS_KEY = 'lumix_ws_v1'
const MAX_FILE = 3 * 1024 * 1024
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) { const p = JSON.parse(raw); setItems(p.items ?? []); setOpen(!!p.open) }
    } catch { /* ignore */ }
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    try { localStorage.setItem(LS_KEY, JSON.stringify({ items, open })) }
    catch { /* quota: drop file dataUrls before giving up */
      try { localStorage.setItem(LS_KEY, JSON.stringify({ items: items.filter((i) => i.kind !== 'file'), open })) } catch { /* ignore */ }
    }
  }, [items, open])

  // expose panel width to fixed drawers AND nudge maps/charts to re-measure
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--workspace-w', open ? 'clamp(280px, 20vw, 360px)' : '40px')
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 260)
    return () => { clearTimeout(t); clearTimeout(t2); root.style.setProperty('--workspace-w', '0px') }
  }, [open])

  useEffect(() => {
    let alive = true
    supabase.from('children').select('id, name').eq('status', 'active').is('deleted_at', null).limit(800)
      .then(({ data }) => { if (alive && data) setChildList(data as ChildRef[]) })
    return () => { alive = false }
  }, [supabase])

  const addInfo = useCallback((i: Omit<WorkspaceInfoItem, 'id' | 'kind' | 'createdAt'>) => {
    setItems((cur) => [{ ...i, id: uid(), kind: 'info', createdAt: Date.now() }, ...cur]); setOpen(true)
  }, [])
  const addMemo = useCallback((init?: Partial<WorkspaceMemoItem>) => {
    setItems((cur) => [{ id: uid(), kind: 'memo', title: init?.title ?? '', body: init?.body ?? '', mentions: init?.mentions ?? [], createdAt: Date.now(), ...init }, ...cur]); setOpen(true)
  }, [])
  const addLink = useCallback((url: string, title?: string, note?: string, accent?: string) => {
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
    let host = u; try { host = new URL(u).hostname } catch { /* keep */ }
    setItems((cur) => [{ id: uid(), kind: 'link', url: u, title: title?.trim() || host, note, accent, createdAt: Date.now() }, ...cur]); setOpen(true)
  }, [])
  const addFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE) { alert('파일이 너무 큽니다 (최대 3MB).'); return }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file)
    })
    setItems((cur) => [{ id: uid(), kind: 'file', name: file.name, mime: file.type || 'application/octet-stream', dataUrl, size: file.size, createdAt: Date.now() }, ...cur]); setOpen(true)
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<WorkspaceItem>) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } as WorkspaceItem : it)))
  }, [])
  const remove = useCallback((id: string) => setItems((cur) => cur.filter((it) => it.id !== id)), [])
  const clearAll = useCallback(() => setItems([]), [])

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
    addInfo, addMemo, addLink, addFile, updateItem, remove, clearAll, integrate, loadSaved,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspace() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return c
}
export function useWorkspaceOptional() {
  return useContext(Ctx)
}
