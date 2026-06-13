import { cn } from '@/lib/utils'

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase', className)}>
      {children}
    </span>
  )
}
