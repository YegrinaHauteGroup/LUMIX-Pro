'use client'

import { useWorkspace, type SnapshotMeta, type WorkspaceFileItem, type WorkspaceInfoItem, type WorkspaceItem, type WorkspaceLinkItem } from '@/lib/workspace'
import { hasCardDrag, parseCardDrop } from '@/lib/cardDrag'
import { MemoPad } from './MemoPad'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { Camera, ChevronDown, ChevronRight, Clock, Database, ExternalLink, FilePlus2, FileText, FolderOpen, Image as ImageIcon, Layers, Link2, Loader2, Maximize2, PanelRightClose, Paperclip, Save, Search, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

function matches(it: WorkspaceItem, q: string): boolean {
  if (!q) return true
  const hay: string[] = []
  if (it.kind === 'memo') hay.push(it.title, it.body, ...(it.mentions ?? []))
  else if (it.kind === 'link') hay.push(it.title, it.url, it.note ?? '')
  else if (it.kind === 'file') hay.push(it.name, it.mime)
  else hay.push(it.source, it.title, it.subtitle ?? '', it.body ?? '', ...(it.fields ?? []).flatMap((f) => [f.label, f.value]))
  return hay.join(' ').toLowerCase().includes(q.toLowerCase())
}

function InfoCard({ item }: { item: WorkspaceInfoItem }) {
  const { remove, updateItem } = useWorkspace()
  const accent = item.accent ?? '#137cbd'
  const open = !!item.expanded
  const hasMore = !!item.body || (item.fields?.length ?? 0) > 2
  return (
    <div className="bg-surface border border-line rounded-[4px] shadow-[0_1px_3px_rgba(16,22,26,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line" style={{ background: accent + '0f' }}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
          <span className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: accent }}>{item.source}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {hasMore && <button onClick={() => updateItem(item.id, { expanded: !open })} title={open ? '접기' : '펼치기'} className="text-ink-faint hover:text-ink">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>}
          <button onClick={() => remove(item.id)} title="삭제" className="text-ink-faint hover:text-danger"><X size={12} /></button>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[12px] font-semibold text-ink leading-tight">{item.title}</p>
        {item.subtitle && <p className="text-[10px] text-ink-faint mt-0.5">{item.subtitle}</p>}
        {item.fields && item.fields.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {(open ? item.fields : item.fields.slice(0, 2)).map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-ink-faint shrink-0">{f.label}</span>
                <span className="text-[10.5px] text-ink-soft text-right break-words">{f.value}</span>
              </div>
            ))}
          </div>
        )}
        {open && item.body && (
          <pre className="mt-2 whitespace-pre-wrap break-words text-[10.5px] leading-relaxed text-ink-soft font-sans border-t border-line pt-2">{item.body}</pre>
        )}
        {item.href && (
          <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover">원본 페이지 <ChevronRight size={11} /></Link>
        )}
      </div>
    </div>
  )
}

function LinkCard({ item }: { item: WorkspaceLinkItem }) {
  const { remove, updateItem } = useWorkspace()
  const open = !!item.expanded
  return (
    <div className="bg-surface border border-line rounded-[4px] shadow-[0_1px_3px_rgba(16,22,26,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line bg-accent-soft/30">
        <span className="flex items-center gap-1.5 min-w-0"><Link2 size={11} className="text-accent shrink-0" /><span className="text-[9px] font-semibold uppercase tracking-wider text-accent truncate">외부 링크</span></span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => updateItem(item.id, { expanded: !open })} title={open ? '접기' : '미리보기'} className="text-ink-faint hover:text-ink"><Maximize2 size={12} /></button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" title="외부에서 열기" className="text-ink-faint hover:text-accent"><ExternalLink size={12} /></a>
          <button onClick={() => remove(item.id)} title="삭제" className="text-ink-faint hover:text-danger"><X size={12} /></button>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[12px] font-semibold text-ink leading-tight break-words">{item.title}</p>
        <p className="text-[10px] text-ink-faint mt-0.5 break-all">{item.url}</p>
        {item.note && <p className="text-[10.5px] text-ink-soft mt-1">{item.note}</p>}
      </div>
      {open && (
        <div className="border-t border-line">
          <iframe src={item.url} title={item.title} className="w-full h-[260px] bg-white" sandbox="allow-scripts allow-same-origin allow-popups" />
          <p className="px-2.5 py-1 text-[9px] text-ink-ghost">일부 사이트는 미리보기를 차단합니다 — <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent">외부에서 열기</a></p>
        </div>
      )}
    </div>
  )
}

function FileCard({ item }: { item: WorkspaceFileItem }) {
  const { remove, updateItem } = useWorkspace()
  const open = !!item.expanded
  const isImg = item.mime.startsWith('image/')
  const isPdf = item.mime === 'application/pdf'
  const kb = item.size < 1024 * 1024 ? `${Math.round(item.size / 1024)}KB` : `${(item.size / 1024 / 1024).toFixed(1)}MB`
  return (
    <div className="bg-surface border border-line rounded-[4px] shadow-[0_1px_3px_rgba(16,22,26,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-line bg-fill-2">
        <span className="flex items-center gap-1.5 min-w-0">{isImg ? <ImageIcon size={11} className="text-[#0f9960] shrink-0" /> : <FileText size={11} className="text-[#0f9960] shrink-0" />}<span className="text-[9px] font-semibold uppercase tracking-wider text-ink-faint truncate">파일</span></span>
        <div className="flex items-center gap-1 shrink-0">
          {(isImg || isPdf) && <button onClick={() => updateItem(item.id, { expanded: !open })} title={open ? '접기' : '미리보기'} className="text-ink-faint hover:text-ink"><Maximize2 size={12} /></button>}
          <a href={item.dataUrl} download={item.name} title="다운로드" className="text-ink-faint hover:text-accent"><ExternalLink size={12} /></a>
          <button onClick={() => remove(item.id)} title="삭제" className="text-ink-faint hover:text-danger"><X size={12} /></button>
        </div>
      </div>
      <div className="px-2.5 py-2"><p className="text-[12px] font-medium text-ink break-words">{item.name}</p><p className="text-[10px] text-ink-faint mt-0.5">{item.mime} · {kb}</p></div>
      {open && isImg && <img src={item.dataUrl} alt={item.name} className="w-full max-h-[260px] object-contain border-t border-line bg-fill-2" />}
      {open && isPdf && <iframe src={item.dataUrl} title={item.name} className="w-full h-[280px] border-t border-line bg-white" />}
    </div>
  )
}

export function WorkspacePanel() {
  const { items, open, setOpen, query, setQuery, addInfo, addMemo, addLink, addFile, integrate, clearAll, busy,
    saveSnapshot, listSnapshots, loadSnapshot, deleteSnapshot, captureScreen } = useWorkspace()
  const [dragOver, setDragOver] = useState(false)
  function onDragOver(e: React.DragEvent) { if (hasCardDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dragOver) setDragOver(true) } }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const p = parseCardDrop(e)
    if (p) { addInfo({ source: p.source, title: p.title, body: p.body, accent: '#5c7080' }); setOpen(true) }
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

      {/* toolbar */}
      <div className="shrink-0 px-2.5 py-2 space-y-1.5">
        <button onClick={captureScreen} className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[3px] text-[11px] font-medium bg-ink text-white hover:opacity-90"><Camera size={13} /> 이 화면 담기 (전체 내역)</button>
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => addMemo()} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium bg-accent text-white hover:bg-accent-hover"><FilePlus2 size={12} /> 메모</button>
          <button onClick={() => setLinkOpen((v) => !v)} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:bg-fill"><Link2 size={12} /> 링크</button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:bg-fill"><Paperclip size={12} /> 파일</button>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f); e.currentTarget.value = '' }} />
        </div>
        {linkOpen && (
          <form onSubmit={(e) => { e.preventDefault(); if (linkUrl.trim()) { addLink(linkUrl.trim()); setLinkUrl(''); setLinkOpen(false) } }}
            className="flex items-center gap-1.5">
            <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="flex-1 min-w-0 px-2 py-1.5 bg-surface border border-line rounded-[3px] text-[11px] text-ink outline-none focus:border-accent" />
            <button type="submit" className="px-2.5 py-1.5 rounded-[3px] bg-accent text-white text-[10.5px] font-medium">추가</button>
          </form>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={doSave} disabled={busy || items.length === 0} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-accent/50 text-accent hover:bg-accent-soft/50 disabled:opacity-40">{savedOk ? '저장됨' : <><Save size={12} /> 저장</>}</button>
          <button onClick={openLoad} disabled={busy} className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:bg-fill disabled:opacity-50"><FolderOpen size={12} /> 불러오기</button>
          <button onClick={() => integrate()} disabled={busy || memoCount === 0} title="메모를 시설 데이터에 반영" className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:bg-fill disabled:opacity-40">{busy ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />} 통합</button>
        </div>
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
          filtered.map((it) =>
            it.kind === 'memo' ? <MemoPad key={it.id} memo={it} />
              : it.kind === 'link' ? <LinkCard key={it.id} item={it} />
                : it.kind === 'file' ? <FileCard key={it.id} item={it} />
                  : <InfoCard key={it.id} item={it} />)
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
