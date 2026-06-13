'use client'

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed gap-2 tracking-wide'

    const variants = {
      primary: 'bg-[#e8e8e8] text-[#080808] hover:bg-white border border-[#e8e8e8]',
      secondary: 'bg-transparent text-[#888888] hover:text-[#e8e8e8] border border-[#262626] hover:border-[#3a3a3a] hover:bg-[#111111]',
      ghost: 'bg-transparent text-[#666666] hover:text-[#e8e8e8] hover:bg-[#111111]',
      danger: 'bg-transparent text-[#ef4444] border border-[#2a1414] hover:bg-[#1a0808] hover:border-[#3a1818]',
    }

    const sizes = {
      sm: 'text-[11px] px-2.5 py-1 h-7',
      md: 'text-[12px] px-3.5 py-1.5 h-8',
      lg: 'text-[13px] px-5 py-2 h-9',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
