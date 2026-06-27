'use client'

import { useWorkspace, type WorkspaceInfoItem, type WorkspaceItem } from '@/lib/workspace'
import { MemoPad } from './MemoPad'
import Link from 'next/link'
import { ChevronRight, Database, FilePlus2, FolderOpen, Layers, Loader2, PanelRightClose, Search, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'

function matches(it: WorkspaceItem, q: string): boolean {
  if (!q) return true
  const hay: string[] = []
  if (it.kind === 'memo') { hay.push(it.title, it.body, ...(it.mentions ?? [])) }
  else { hay.push(it.source, it.title, it.subtitle ?? '', ...(it.fields ?? []).flatMap((f) => [f.label, f.value])) }
  return hay.join(' ').toLowerCase().includes(q.toLowerCase())
}

function InfoCard({ item }: { item: WorkspaceInfoItem }) {
  const { remove } = useWorkspace()
  const accent = item.accent ?? '#137cbd'
  return (
    <div className="bg-surface border border-line rounded-[4px] shadow-[0_1px_3px_rgba(16,22,26,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line" style={{ background: accent + '0f' }}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
          <span className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: accent }}>{item.source}</span>
        </span>
        <button onClick={() => remove(item.id)} title="삭제" className="text-ink-faint hover:text-danger shrink-0"><X size={12} /></button>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[12px] font-semibold text-ink leading-tight">{item.title}</p>
        {item.subtitle && <p className="text-[10px] text-ink-faint mt-0.5">{item.subtitle}</p>}
        {item.fields && item.fields.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {item.fields.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-ink-faint shrink-0">{f.label}</span>
                <span className="text-[10.5px] text-ink-soft text-right break-words">{f.value}</span>
              </div>
            ))}
          </div>
        )}
        {item.href && (
          <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover">원본 보기 <ChevronRight size={11} /></Link>
        )}
      </div>
    </div>
  )
}

export function WorkspacePanel() {
  const { items, open, setOpen, query, setQuery, addMemo, loadSaved, integrate, clearAll, busy } = useWorkspace()
  const filtered = useMemo(() => items.filter((it) => matches(it, query)), [items, query])
  const memoCount = items.filter((i) => i.kind === 'memo').length

  // collapsed rail
  if (!open) {
    return (
      <aside className="shrink-0 w-[40px] border-l border-line bg-fill-2 flex flex-col items-center py-2 gap-2">
        <button onClick={() => setOpen(true)} title="작업창 열기" className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-accent hover:bg-surface">
          <Layers size={16} />
        </button>
        {items.length > 0 && <span className="text-[9px] font-data text-ink-faint tabular-nums">{items.length}</span>}
        <button onClick={() => { addMemo(); }} title="메모 추가" className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-accent hover:bg-surface mt-auto">
          <FilePlus2 size={15} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="shrink-0 border-l border-line bg-fill-2 flex flex-col h-full" style={{ width: 'clamp(280px, 20vw, 360px)' }}>
      {/* header */}
      <div className="shrink-0 px-3 h-11 flex items-center justify-between border-b border-line bg-surface">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-accent" />
          <span className="text-[12px] font-semibold text-ink">작업창</span>
          <span className="text-[10px] text-ink-faint font-data tabular-nums">{items.length}</span>
        </div>
        <button onClick={() => setOpen(false)} title="접기" className="text-ink-faint hover:text-ink p-1 rounded-[3px] hover:bg-fill"><PanelRightClose size={15} /></button>
      </div>

      {/* search */}
      <div className="shrink-0 px-2.5 pt-2.5">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface border border-line rounded-[3px]">
          <Search size={13} className="text-ink-faint shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작업창 내용 검색"
            className="flex-1 min-w-0 bg-transparent text-[11.5px] text-ink placeholder:text-ink-ghost outline-none" />
          {query && <button onClick={() => setQuery('')} className="text-ink-faint hover:text-ink"><X size={12} /></button>}
        </div>
      </div>

      {/* toolbar */}
      <div className="shrink-0 px-2.5 py-2 grid grid-cols-3 gap-1.5">
        <button onClick={() => addMemo()} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium bg-accent text-white hover:bg-accent-hover">
          <FilePlus2 size={12} /> 메모
        </button>
        <button onClick={() => loadSaved()} disabled={busy} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:bg-fill disabled:opacity-50">
          <FolderOpen size={12} /> 불러오기
        </button>
        <button onClick={() => integrate()} disabled={busy || memoCount === 0} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-accent/50 text-accent hover:bg-accent-soft/50 disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />} 통합
        </button>
      </div>

      {/* items */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
            <Layers size={26} className="text-ink-ghost mb-2" />
            <p className="text-[12px] text-ink-soft font-medium">작업창이 비어 있습니다</p>
            <p className="text-[10.5px] text-ink-faint mt-1">앱 곳곳의 <span className="text-accent font-medium">+ 작업창</span> 버튼이나 위 <span className="text-accent font-medium">메모</span> 버튼으로 내용을 모아 연속적으로 작업하세요.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] text-ink-ghost text-center py-8">검색 결과가 없습니다</p>
        ) : (
          filtered.map((it) => it.kind === 'memo' ? <MemoPad key={it.id} memo={it} /> : <InfoCard key={it.id} item={it} />)
        )}
      </div>

      {/* footer */}
      {items.length > 0 && (
        <div className="shrink-0 px-2.5 py-2 border-t border-line bg-surface flex items-center justify-between">
          <span className="text-[10px] text-ink-faint">{memoCount}개 메모 · {items.length - memoCount}개 정보</span>
          <button onClick={() => { if (confirm('작업창의 모든 항목을 비울까요?')) clearAll() }} className="inline-flex items-center gap-1 text-[10px] text-ink-faint hover:text-danger">
            <Trash2 size={11} /> 전체 비우기
          </button>
        </div>
      )}
    </aside>
  )
}
