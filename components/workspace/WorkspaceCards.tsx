'use client'

// Workspace item card renderers, extracted from WorkspacePanel to keep that
// file focused on panel layout/toolbar and to isolate per-card re-renders (H2).
import { useWorkspace, type WorkspaceFileItem, type WorkspaceInfoItem, type WorkspaceItem, type WorkspaceLinkItem } from '@/lib/workspace'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Link2, Maximize2, Smartphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function matches(it: WorkspaceItem, q: string): boolean {
  if (!q) return true
  const hay: string[] = []
  if (it.kind === 'memo') hay.push(it.title, it.body, ...(it.mentions ?? []))
  else if (it.kind === 'link') hay.push(it.title, it.url, it.note ?? '')
  else if (it.kind === 'file') hay.push(it.name, it.mime)
  else hay.push(it.source, it.title, it.subtitle ?? '', it.body ?? '', ...(it.fields ?? []).flatMap((f) => [f.label, f.value]))
  return hay.join(' ').toLowerCase().includes(q.toLowerCase())
}

/** Re-visualizes a dragged chart's data as a mini bar chart + source table. */
function TableViz({ table, accent, open }: { table: { cols: string[]; rows: (string | number)[][] }; accent: string; open: boolean }) {
  const cols = table.cols, rows = table.rows
  let valIdx = cols.length - 1
  for (let j = cols.length - 1; j >= 1; j--) { if (rows.some((r) => !isNaN(Number(r[j])))) { valIdx = j; break } }
  const nums = rows.map((r) => Number(r[valIdx]) || 0)
  const max = Math.max(1, ...nums.map(Math.abs))
  return (
    <div className="mt-2 border-t border-line pt-2 space-y-2">
      <div className="space-y-1">
        {rows.slice(0, 10).map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[9.5px] text-ink-faint w-16 truncate shrink-0">{String(r[0])}</span>
            <div className="flex-1 h-2 bg-fill rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(Math.abs(nums[i]) / max) * 100}%`, background: accent }} /></div>
            <span className="text-[9.5px] font-data tabular-nums text-ink-soft w-9 text-right shrink-0">{r[valIdx]}</span>
          </div>
        ))}
      </div>
      {open && (
        <div className="border border-line rounded-[2px] overflow-x-auto">
          <table className="w-full text-[9.5px]">
            <thead><tr className="bg-fill-2">{cols.map((c, j) => <th key={c} className={`px-1.5 py-1 text-ink-faint font-semibold ${j === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((v, j) => <td key={j} className={`px-1.5 py-0.5 ${j === 0 ? 'text-ink' : 'text-ink-soft text-right font-data tabular-nums'}`}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function InfoCard({ item }: { item: WorkspaceInfoItem }) {
  const { remove, updateItem } = useWorkspace()
  const accent = item.accent ?? '#137cbd'
  const open = !!item.expanded
  const hasMore = !!item.body || (item.fields?.length ?? 0) > 2 || !!item.table
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
        {item.table && item.table.rows.length > 0 && <TableViz table={item.table} accent={accent} open={open} />}
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

/** Renders a site at a 375px mobile viewport, scaled down to fit the panel width. */
function MobilePreview({ url, title }: { url: string; title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const MOBILE_W = 375, MOBILE_H = 620
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setScale(Math.min(1, el.clientWidth / MOBILE_W))
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={wrapRef} className="border-t border-line bg-fill-2 overflow-hidden" style={{ height: MOBILE_H * scale }}>
      <iframe src={url} title={title} className="bg-white origin-top-left"
        style={{ width: MOBILE_W, height: MOBILE_H, transform: `scale(${scale})` }}
        sandbox="allow-scripts allow-same-origin allow-popups" />
    </div>
  )
}

export function LinkCard({ item }: { item: WorkspaceLinkItem }) {
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
        <div>
          <span className="flex items-center gap-1 px-2.5 pt-1.5 pb-1 text-[9px] text-ink-ghost"><Smartphone size={10} /> 모바일 미리보기</span>
          <MobilePreview url={item.url} title={item.title} />
          <p className="px-2.5 py-1 text-[9px] text-ink-ghost">일부 사이트는 미리보기를 차단합니다 — <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent">외부에서 열기</a></p>
        </div>
      )}
    </div>
  )
}

export function FileCard({ item }: { item: WorkspaceFileItem }) {
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
