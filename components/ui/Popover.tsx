'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

interface PopoverProps {
  trigger: React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: 'left' | 'right'
  width?: number
  className?: string
}

/**
 * Lightweight anchored popover — opens content next to its trigger so info is
 * accessible in-place (no navigation away). Closes on outside click / Escape.
 */
export function Popover({ trigger, children, align = 'left', width = 280, className }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full text-left">{trigger}</button>
      {open && (
        <div
          style={{ width }}
          className={cn(
            'absolute z-50 mt-1.5 bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)] overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}
