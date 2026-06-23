import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

const fieldBase =
  'w-full bg-surface border border-line rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-ghost ' +
  'transition-all focus:outline-none focus:border-accent focus:shadow-[var(--shadow-glow)]'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.08em]">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-ghost">{icon}</div>
        )}
        <input
          ref={ref}
          className={cn(fieldBase, 'h-9', icon && 'pl-9', error && 'border-[color:var(--color-danger)]', className)}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
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
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.08em]">{label}</label>}
      <select
        ref={ref}
        className={cn(fieldBase, 'h-9 cursor-pointer', error && 'border-[color:var(--color-danger)]', className)}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-danger">{error}</p>}
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
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.08em]">{label}</label>}
      <textarea
        ref={ref}
        className={cn(fieldBase, 'resize-none', error && 'border-[color:var(--color-danger)]', className)}
        {...props}
      />
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
