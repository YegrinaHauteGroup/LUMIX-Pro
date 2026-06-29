'use client'

// Root error boundary (M10). Catches errors thrown in the root layout itself.
// Must render its own <html>/<body> since it replaces the whole document.
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'Pretendard, system-ui, sans-serif', background: '#f3f6f9' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#182026', margin: '0 0 8px' }}>예기치 못한 오류가 발생했습니다</h1>
            <p style={{ fontSize: 13, color: '#5c7080', margin: '0 0 16px' }}>잠시 후 다시 시도해 주세요. 문제가 지속되면 관리자에게 문의하세요.</p>
            <button onClick={() => reset()} style={{ height: 36, padding: '0 18px', borderRadius: 4, border: 'none', background: '#3b7fb0', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>다시 시도</button>
          </div>
        </div>
      </body>
    </html>
  )
}
