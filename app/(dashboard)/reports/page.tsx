import { redirect } from 'next/navigation'

// 보고서 플랫폼은 통합 대시보드(/dashboard)로 합쳐졌습니다.
export default function ReportsPage() {
  redirect('/dashboard')
}
