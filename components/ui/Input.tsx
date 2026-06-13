import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444444]">{icon}</div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-[#0e0e0e] border border-[#222222] px-3 py-2 text-[13px] text-[#e8e8e8] placeholder-[#333333]',
            'focus:outline-none focus:border-[#444444] transition-colors h-8 rounded-sm',
            icon && 'pl-9',
            error && 'border-[#5a1a1a]',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full bg-[#0e0e0e] border border-[#222222] px-3 py-2 text-[13px] text-[#e8e8e8]',
          'focus:outline-none focus:border-[#444444] transition-colors h-8 rounded-sm cursor-pointer',
          error && 'border-[#5a1a1a]',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[11px] font-medium text-[#666666] uppercase tracking-wider">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-[#0e0e0e] border border-[#222222] px-3 py-2 text-[13px] text-[#e8e8e8] placeholder-[#333333]',
          'focus:outline-none focus:border-[#444444] transition-colors rounded-sm resize-none',
          error && 'border-[#5a1a1a]',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
