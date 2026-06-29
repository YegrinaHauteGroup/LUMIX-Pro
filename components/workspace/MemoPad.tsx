'use client'

import { useWorkspace, type WorkspaceMemoItem } from '@/lib/workspace'
import { Check, Database, Maximize2, Minimize2, Trash2, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

/** A square memo pad. Expands to a larger editor; supports @아동 mentions. */
export function MemoPad({ memo }: { memo: WorkspaceMemoItem }) {
  const { updateItem, remove, integrate, childList, busy } = useWorkspace()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null)

  const suggestions = useMemo(() => {
    if (!mention) return []
    const q = mention.q.toLowerCase()
    return childList.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mention, childList])

  function onBody(v: string) {
    updateItem(memo.id, { body: v })
    // detect an active @token immediately before the caret
    const el = taRef.current
    const caret = el ? el.selectionStart : v.length
    const upto = v.slice(0, caret)
    const m = upto.match(/@([^\s@]{0,20})$/)
    setMention(m ? { q: m[1], start: caret - m[1].length - 1 } : null)
  }

  function applyMention(name: string) {
    if (!mention) return
    const el = taRef.current
    const caret = el ? el.selectionStart : memo.body.length
    const before = memo.body.slice(0, mention.start)
    const after = memo.body.slice(caret)
    const next = `${before}@${name} ${after}`
    updateItem(memo.id, { body: next, mentions: Array.from(new Set([...(memo.mentions ?? []), name])) })
    setMention(null)
    requestAnimationFrame(() => { el?.focus(); const pos = (before + '@' + name + ' ').length; el?.setSelectionRange(pos, pos) })
  }

  const expanded = !!memo.expanded

  return (
    <div className={`relative bg-[#fffdf5] border border-[#e6dcae] rounded-[4px] shadow-[0_1px_3px_rgba(16,22,26,0.10)] flex flex-col overflow-hidden ${expanded ? '' : 'aspect-square'}`}>
      {/* top bar: delete · integrate · expand */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#ece3bd] bg-[#fbf6df]">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[#9a8a4d] uppercase tracking-wider">
          메모{memo.integrated && <Check size={10} className="text-[#0f9960]" />}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => integrate(memo.id)} disabled={busy} title="이 메모를 시설 데이터에 통합"
            className="w-5 h-5 flex items-center justify-center rounded-[3px] text-[#9a8a4d] hover:text-accent hover:bg-white/60 disabled:opacity-40"><Database size={12} /></button>
          <button onClick={() => updateItem(memo.id, { expanded: !expanded })} title={expanded ? '축소' : '확장'}
            className="w-5 h-5 flex items-center justify-center rounded-[3px] text-[#9a8a4d] hover:text-ink hover:bg-white/60">{expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</button>
          <button onClick={() => remove(memo.id)} title="삭제"
            className="w-5 h-5 flex items-center justify-center rounded-[3px] text-[#9a8a4d] hover:text-danger hover:bg-white/60"><Trash2 size={12} /></button>
        </div>
      </div>

      <input
        value={memo.title} onChange={(e) => updateItem(memo.id, { title: e.target.value })} placeholder="제목"
        className="px-2.5 pt-1.5 pb-1 text-[12px] font-semibold text-ink bg-transparent outline-none placeholder:text-[#c4b780]" />

      <div className="relative flex-1 min-h-0">
        <textarea
          ref={taRef} value={memo.body} onChange={(e) => onBody(e.target.value)} onBlur={() => setTimeout(() => setMention(null), 150)}
          placeholder="작업 내용을 작성하세요. @아동이름 으로 아동을 연결할 수 있습니다."
          className={`w-full ${expanded ? 'h-[220px]' : 'h-full'} resize-none px-2.5 pb-2 text-[11.5px] leading-relaxed text-ink-soft bg-transparent outline-none overflow-y-auto placeholder:text-[#c4b780]`} />
        {mention && suggestions.length > 0 && (
          <div className="absolute left-2 bottom-2 z-10 w-[180px] bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] overflow-hidden">
            <p className="px-2 py-1 text-[9px] text-ink-faint uppercase tracking-wider border-b border-line flex items-center gap-1"><Users size={10} /> 아동 연결</p>
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => applyMention(c.name)} className="w-full text-left px-2 py-1.5 text-[11.5px] text-ink hover:bg-fill">{c.name}</button>
            ))}
          </div>
        )}
      </div>

      {memo.mentions.length > 0 && (
        <div className="px-2.5 py-1.5 border-t border-[#ece3bd] flex flex-wrap gap-1">
          {memo.mentions.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-soft text-accent text-[9.5px]"><Users size={9} /> {m}</span>
          ))}
        </div>
      )}
    </div>
  )
}
