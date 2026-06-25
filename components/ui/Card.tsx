import { cn } from '@/lib/utils'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)]', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 pt-3.5 pb-3 border-b border-line', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em]', className)}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>
}
