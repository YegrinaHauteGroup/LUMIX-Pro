'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

/**
 * Foundry-style right-side workspace drawer. Slides in from the right,
 * overlays content, and can host detail/edit panels without leaving the page.
 */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 420 }: DrawerProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  return (
    <>
      <div
        style={{ right: 'var(--workspace-w, 0px)' }}
        className={cn('fixed inset-y-0 left-0 z-40 bg-[#10161a]/20 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />
      {/* Clipping viewport: spans from the left up to the workspace's left edge
          and hides overflow, so the panel slides in entirely to the LEFT of the
          workspace and never travels across it. */}
      <div
        style={{ right: 'var(--workspace-w, 0px)' }}
        className="fixed inset-y-0 left-0 z-50 overflow-hidden pointer-events-none"
      >
        <aside
          style={{ width }}
          className={cn(
            'absolute top-0 right-0 h-full max-w-[92vw] bg-surface border-l border-line shadow-[var(--shadow-pop)] flex flex-col transition-transform duration-200 ease-out',
            open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none',
          )}
        >
          <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line bg-fill-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{title}</p>
              {subtitle && <p className="text-[10.5px] text-ink-faint truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="text-ink-faint hover:text-ink hover:bg-fill rounded-[3px] p-1.5 transition-colors">
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-4 py-3 bg-fill-2">{footer}</div>}
        </aside>
      </div>
    </>
  )
}
