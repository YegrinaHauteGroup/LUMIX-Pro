'use client'

import { ChevronDown, ChevronUp, List } from 'lucide-react'
import { useState } from 'react'

/** Collapsible bottom dock holding the detailed roster lists; expands upward
 *  into a scrollable region. */
export function RosterDock({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="shrink-0 border border-line rounded-[3px] bg-surface shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
      <button onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 flex items-center justify-between border-b border-line bg-fill-2 hover:bg-fill transition-colors shrink-0">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider"><List size={13} className="text-accent" /> 아동·반 상세 목록</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-faint">{open ? '접기' : '펼치기'} {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</span>
      </button>
      {open && (
        <div className="h-[54vh] overflow-y-auto p-3">{children}</div>
      )}
    </div>
  )
}
