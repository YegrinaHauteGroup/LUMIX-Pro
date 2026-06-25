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
    const base =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-[3px] cursor-pointer ' +
      'disabled:opacity-40 disabled:cursor-not-allowed gap-1.5 tracking-[-0.01em] ' +
      'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]'

    const variants = {
      primary: 'bg-accent text-white hover:bg-accent-hover shadow-[0_1px_2px_rgba(14,23,38,0.08)]',
      secondary: 'bg-surface text-ink-soft border border-line hover:border-line-strong hover:bg-fill',
      ghost: 'bg-transparent text-ink-faint hover:text-ink hover:bg-fill',
      danger: 'bg-surface text-danger border border-[color:var(--color-danger-soft)] hover:bg-[color:var(--color-danger-soft)]',
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
