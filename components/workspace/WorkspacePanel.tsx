'use client'

import { useWorkspace, type SnapshotMeta } from '@/lib/workspace'
import { hasCardDrag, parseCardDrop } from '@/lib/cardDrag'
import { MemoPad } from './MemoPad'
import { WorkspaceTools } from './WorkspaceTools'
import { matches, InfoCard, LinkCard, FileCard } from './WorkspaceCards'
import { Modal } from '@/components/ui/Modal'
import { Calculator, Camera, Clock, Database, FilePlus2, FolderOpen, Layers, Link2, Loader2, PanelRightClose, Paperclip, Save, Search, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

export function WorkspacePanel() {
  const { items, open, setOpen, query, setQuery, addInfo, addMemo, addLink, addFile, integrate, clearAll, busy,
    saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, captureScreen } = useWorkspace()
  const [dragOver, setDragOver] = useState(false)
  function onDragOver(e: React.DragEvent) { if (hasCardDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dragOver) setDragOver(true) } }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const p = parseCardDrop(e)
    if (p) { addInfo({ source: p.source, title: p.title, body: p.table ? undefined : p.body, table: p.table, accent: '#5c7080' }); setOpen(true) }
  }
  const filtered = useMemo(() => items.filter((it) => matches(it, query)), [items, query])
  const memoCount = items.filter((i) => i.kind === 'memo').length
  const fileRef = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [clearArmed, setClearArmed] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [snaps, setSnaps] = useState<SnapshotMeta[] | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)

  async function openLoad() { setLoadOpen(true); setSnaps(null); setSnaps(await listSnapshots()) }
  async function doSave() { await saveSnapshot(); setSavedOk(true); setTimeout(() => setSavedOk(false), 1800) }

  if (!open) {
    return (
      <aside onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        className={`shrink-0 w-[40px] border-l bg-fill-2 flex flex-col items-center py-2 gap-2 ${dragOver ? 'border-accent bg-accent-soft/40' : 'border-line'}`}>
        <button onClick={() => setOpen(true)} title="작업창 열기" className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-accent hover:bg-surface"><Layers size={16} /></button>
        {items.length > 0 && <span className="text-[9px] font-data text-ink-faint tabular-nums">{items.length}</span>}
        <button onClick={() => addMemo()} title="메모 추가" className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-soft hover:text-accent hover:bg-surface mt-auto"><FilePlus2 size={15} /></button>
      </aside>
    )
  }

  return (
    <aside onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
      className={`shrink-0 border-l bg-fill-2 flex flex-col h-full ${dragOver ? 'border-accent ring-1 ring-inset ring-accent/40' : 'border-line'}`} style={{ width: 'clamp(280px, 20vw, 360px)' }}>
      <div className="shrink-0 px-3 h-11 flex items-center justify-between border-b border-line bg-surface">
        <div className="flex items-center gap-1.5"><Layers size={14} className="text-accent" /><span className="text-[12px] font-semibold text-ink">작업창</span><span className="text-[10px] text-ink-faint font-data tabular-nums">{items.length}</span></div>
        <button onClick={() => setOpen(false)} title="접기" className="text-ink-faint hover:text-ink p-1 rounded-[3px] hover:bg-fill"><PanelRightClose size={15} /></button>
      </div>

      <div className="shrink-0 px-2.5 pt-2.5">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface border border-line rounded-[3px]">
          <Search size={13} className="text-ink-faint shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="작업창 내용 검색" className="flex-1 min-w-0 bg-transparent text-[11.5px] text-ink placeholder:text-ink-ghost outline-none" />
          {query && <button onClick={() => setQuery('')} className="text-ink-faint hover:text-ink"><X size={12} /></button>}
        </div>
      </div>

      {/* toolbar — compact icon buttons */}
      <div className="shrink-0 px-2.5 py-2 space-y-1.5">
        <button onClick={captureScreen} className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-[3px] text-[10.5px] font-medium bg-ink text-white hover:opacity-90"><Camera size={12} /> 이 화면 담기</button>
        <div className="grid grid-cols-6 gap-1">
          <button onClick={() => addMemo()} title="메모 추가" className="h-7 inline-flex items-center justify-center rounded-[3px] bg-accent text-white hover:bg-accent-hover"><FilePlus2 size={13} /></button>
          <button onClick={() => setLinkOpen((v) => !v)} title="링크 추가" className={`h-7 inline-flex items-center justify-center rounded-[3px] border hover:bg-fill ${linkOpen ? 'border-accent text-accent bg-accent-soft/40' : 'border-line text-ink-soft'}`}><Link2 size={13} /></button>
          <button onClick={() => fileRef.current?.click()} title="파일 첨부" className="h-7 inline-flex items-center justify-center rounded-[3px] border border-line text-ink-soft hover:bg-fill"><Paperclip size={13} /></button>
          <button onClick={() => setToolsOpen((v) => !v)} title="계산기·스톱워치·타이머" className={`h-7 inline-flex items-center justify-center rounded-[3px] border hover:bg-fill ${toolsOpen ? 'border-accent text-accent bg-accent-soft/40' : 'border-line text-ink-soft'}`}><Calculator size={13} /></button>
          <button onClick={doSave} disabled={busy || items.length === 0} title="작업창 저장" className="h-7 inline-flex items-center justify-center rounded-[3px] border border-accent/50 text-accent hover:bg-accent-soft/50 disabled:opacity-40">{savedOk ? <span className="text-[9px] font-semibold">OK</span> : <Save size={13} />}</button>
          <button onClick={openLoad} disabled={busy} title="불러오기" className="h-7 inline-flex items-center justify-center rounded-[3px] border border-line text-ink-soft hover:bg-fill disabled:opacity-50"><FolderOpen size={13} /></button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f); e.currentTarget.value = '' }} />
        </div>
        {memoCount > 0 && (
          <button onClick={() => integrate()} disabled={busy} title="메모를 시설 데이터에 반영" className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] font-medium border border-line text-ink-soft hover:bg-fill disabled:opacity-40">{busy ? <Loader2 size={11} className="animate-spin" /> : <Database size={11} />} 메모 {memoCount}개 통합</button>
        )}
        {linkOpen && (
          <form onSubmit={(e) => { e.preventDefault(); if (linkUrl.trim()) { addLink(linkUrl.trim()); setLinkUrl(''); setLinkOpen(false) } }}
            className="flex items-center gap-1.5">
            <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="flex-1 min-w-0 px-2 py-1.5 bg-surface border border-line rounded-[3px] text-[11px] text-ink outline-none focus:border-accent" />
            <button type="submit" className="px-2.5 py-1.5 rounded-[3px] bg-accent text-white text-[10.5px] font-medium">추가</button>
          </form>
        )}
        {toolsOpen && <WorkspaceTools />}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
            <Layers size={26} className="text-ink-ghost mb-2" />
            <p className="text-[12px] text-ink-soft font-medium">작업창이 비어 있습니다</p>
            <p className="text-[10.5px] text-ink-faint mt-1">아무 <span className="text-accent font-medium">카드</span>나 이곳으로 끌어다 놓거나, <span className="text-accent font-medium">+ 작업창</span> 버튼·<span className="text-accent font-medium">메모·링크·파일</span>로 내용을 모아 연속 작업하세요.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] text-ink-ghost text-center py-8">검색 결과가 없습니다</p>
        ) : (
          filtered.map((it) => (
            <div key={it.id} className="ws-resizable overflow-auto" style={{ resize: 'vertical', minHeight: 44 }}>
              {it.kind === 'memo' ? <MemoPad memo={it} />
                : it.kind === 'link' ? <LinkCard item={it} />
                  : it.kind === 'file' ? <FileCard item={it} />
                    : <InfoCard item={it} />}
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="shrink-0 px-2.5 py-2 border-t border-line bg-surface flex items-center justify-between">
          <span className="text-[10px] text-ink-faint">{memoCount}개 메모 · {items.length - memoCount}개 항목</span>
          <button onClick={() => { if (clearArmed) { clearAll(); setClearArmed(false) } else { setClearArmed(true); setTimeout(() => setClearArmed(false), 3000) } }}
            className={`inline-flex items-center gap-1 text-[10px] ${clearArmed ? 'text-danger font-semibold' : 'text-ink-faint hover:text-danger'}`}>
            <Trash2 size={11} /> {clearArmed ? '한 번 더 클릭' : '전체 비우기'}
          </button>
        </div>
      )}

      {/* saved snapshots picker */}
      <Modal open={loadOpen} onClose={() => setLoadOpen(false)} title="저장된 작업창 불러오기" size="md">
        {snaps === null ? (
          <p className="text-[12px] text-ink-faint py-6 text-center">불러오는 중…</p>
        ) : snaps.length === 0 ? (
          <p className="text-[12px] text-ink-faint py-6 text-center">저장된 작업창이 없습니다. 먼저 <span className="text-accent">저장</span>하세요.</p>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {snaps.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 border border-line rounded-[3px] hover:bg-fill">
                <button onClick={async () => { await loadSnapshot(s.id); setLoadOpen(false) }} className="flex items-center gap-2 min-w-0 text-left flex-1">
                  <Clock size={13} className="text-ink-faint shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-ink truncate">{s.title ?? '작업창'}</span>
                    <span className="block text-[10px] text-ink-faint">{new Date(s.created_at).toLocaleString('ko-KR')} · {s.item_count}개 항목</span>
                  </span>
                </button>
                <button onClick={async () => { await deleteSnapshot(s.id); setSnaps((cur) => (cur ?? []).filter((x) => x.id !== s.id)) }} title="삭제" className="text-ink-faint hover:text-danger shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </aside>
  )
}
