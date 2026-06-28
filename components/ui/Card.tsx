'use client'

import { cn } from '@/lib/utils'
import { cardDragStart } from '@/lib/cardDrag'

/**
 * Card. Draggable by default so its content can be dropped into the workspace
 * (the "organic connection" affordance). Pass `noDrag` to opt out (forms,
 * modal bodies), or `dragSource` to label where the dropped content came from.
 */
export function Card({ children, className, dragSource = '카드', noDrag }: { children: React.ReactNode; className?: string; dragSource?: string; noDrag?: boolean }) {
  return (
    <div
      className={cn('bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)]', className)}
      draggable={!noDrag}
      onDragStart={noDrag ? undefined : (e) => cardDragStart(e, dragSource)}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 pt-3.5 pb-3 border-b border-line', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 data-card-title className={cn('text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em]', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>
}
