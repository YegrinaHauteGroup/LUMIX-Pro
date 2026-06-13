'use client'

import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed gap-2'

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
      secondary: 'bg-[#222222] hover:bg-[#2a2a2a] text-[#f5f5f5] border border-[#333333]',
      ghost: 'hover:bg-[#1a1a1a] text-[#a0a0a0] hover:text-[#f5f5f5]',
      danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
      outline: 'border border-[#333333] hover:border-[#444444] text-[#f5f5f5] hover:bg-[#1a1a1a]',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5 h-7',
      md: 'text-sm px-4 py-2 h-9',
      lg: 'text-base px-6 py-2.5 h-11',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
