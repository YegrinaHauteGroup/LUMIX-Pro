'use client'

import { useWorkspaceOptional, type InfoField } from '@/lib/workspace'
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'

interface Props {
  source: string
  title: string
  subtitle?: string
  fields?: InfoField[]
  href?: string
  accent?: string
  /** 'icon' = compact square button, 'chip' = labeled pill */
  variant?: 'icon' | 'chip'
  className?: string
}

/**
 * Universal "+ 작업창" affordance. Drop it next to any piece of information in
 * the SaaS to collect it into the persistent right-side workspace.
 */
export function AddToWorkspaceButton({ source, title, subtitle, fields, href, accent, variant = 'icon', className }: Props) {
  const ws = useWorkspaceOptional()
  const [done, setDone] = useState(false)
  if (!ws) return null

  const onAdd = () => {
    ws.addInfo({ source, title, subtitle, fields, href, accent })
    setDone(true)
    setTimeout(() => setDone(false), 1200)
  }

  if (variant === 'chip') {
    return (
      <button onClick={onAdd} title="작업창에 추가"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10.5px] font-medium border border-line text-ink-soft hover:text-accent hover:border-accent/50 hover:bg-accent-soft/40 transition-colors ${className ?? ''}`}>
        {done ? <Check size={12} className="text-[#0f9960]" /> : <Plus size={12} />} 작업창
      </button>
    )
  }
  return (
    <button onClick={onAdd} title="작업창에 추가"
      className={`w-6 h-6 inline-flex items-center justify-center rounded-[3px] text-ink-faint hover:text-accent hover:bg-accent-soft/50 transition-colors ${className ?? ''}`}>
      {done ? <Check size={13} className="text-[#0f9960]" /> : <Plus size={14} />}
    </button>
  )
}
