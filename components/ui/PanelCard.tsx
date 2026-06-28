'use client'

import { cn } from '@/lib/utils'
import { cardDragStart } from '@/lib/cardDrag'
import { Maximize2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Modal } from './Modal'

interface PanelCardProps {
  title: string
  subtitle?: string
  /** optional edit handler — shows a pencil action in the header */
  onEdit?: () => void
  /** detail content shown in an expand modal — shows a maximize action */
  detail?: React.ReactNode
  detailTitle?: string
  detailSize?: 'md' | 'lg' | 'xl'
  headerRight?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * Foundry-style panel: a crisp bordered card with a dense header that
 * exposes inline actions (edit / expand-to-detail). The expand action opens
 * a larger modal so data can be inspected in depth.
 */
export function PanelCard({
  title, subtitle, onEdit, detail, detailTitle, detailSize = 'xl', headerRight,
  children, className, bodyClassName,
}: PanelCardProps) {
  const [open, setOpen] = useState(false)
  return (
    <div draggable
      onMouseDown={(e) => { const i = (e.target as HTMLElement).closest('input,textarea,select,button,a,label,[contenteditable="true"]'); (e.currentTarget as HTMLDivElement).draggable = !i }}
      onDragStart={(e) => cardDragStart(e, title)}
      className={cn('bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] flex flex-col', className)}>
      <div className="flex items-center justify-between px-4 h-10 border-b border-line shrink-0">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-ink-ghost truncate -mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-0.5">
          {headerRight}
          {onEdit && (
            <button onClick={onEdit} title="편집"
              className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill transition-colors">
              <Pencil size={13} />
            </button>
          )}
          {detail !== undefined && (
            <button onClick={() => setOpen(true)} title="확대"
              className="w-7 h-7 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill transition-colors">
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className={cn('px-4 py-4 flex-1', bodyClassName)}>{children}</div>
      {detail !== undefined && (
        <Modal open={open} onClose={() => setOpen(false)} title={detailTitle ?? title} size={detailSize}>
          {detail}
        </Modal>
      )}
    </div>
  )
}
