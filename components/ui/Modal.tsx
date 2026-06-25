'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0e1726]/35 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-surface border border-line rounded-[4px] shadow-[var(--shadow-pop)]', sizes[size])}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-fill-2">
          <h2 className="text-[13px] font-semibold text-ink tracking-[-0.01em]">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink hover:bg-fill rounded-[3px] transition-colors p-1.5"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5 max-h-[82vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
