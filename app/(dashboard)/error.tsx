'use client'

// Dashboard segment error boundary (M10) — keeps the app shell (sidebar/header)
// mounted and only replaces the page content, so one page's exception doesn't
// crash the whole app. Themed with the app's design tokens.
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-danger-soft flex items-center justify-center">
          <AlertTriangle size={22} className="text-danger" />
        </span>
        <h1 className="text-[15px] font-semibold text-ink">이 페이지를 불러오지 못했습니다</h1>
        <p className="text-[12.5px] text-ink-faint mt-1.5 leading-relaxed">
          일시적인 오류일 수 있습니다. 다시 시도하거나 다른 메뉴로 이동해 보세요.
          {error.digest && <span className="block mt-1 text-[10px] text-ink-ghost font-data">오류 코드: {error.digest}</span>}
        </p>
        <button onClick={() => reset()} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-[3px] bg-accent text-white text-[13px] font-medium hover:bg-accent-hover">
          <RotateCcw size={14} /> 다시 시도
        </button>
      </div>
    </div>
  )
}
