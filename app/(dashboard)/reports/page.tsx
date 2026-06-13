import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ReportsCharts } from '@/components/features/reports/ReportsCharts'

export default async function ReportsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [childrenRes, activitiesRes, classesRes] = await Promise.all([
    supabase.from('children').select('id, status, gender, class_id, created_at'),
    supabase.from('activities').select('id, type, status, date'),
    supabase.from('classes').select('id, name'),
  ])

  const children = childrenRes.data ?? []
  const activities = activitiesRes.data ?? []
  const classes = classesRes.data ?? []

  // Monthly registration data (last 6 months)
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = `${d.getMonth() + 1}월`
    const count = children.filter((c) => {
      const cd = new Date(c.created_at)
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
    }).length
    return { month: label, 등록: count }
  })

  // Activity type breakdown
  const activityTypeData = [
    { name: '교육', value: activities.filter((a) => a.type === 'education').length },
    { name: '치료', value: activities.filter((a) => a.type === 'therapy').length },
    { name: '레크리에이션', value: activities.filter((a) => a.type === 'recreation').length },
    { name: '상담', value: activities.filter((a) => a.type === 'counseling').length },
    { name: '기타', value: activities.filter((a) => a.type === 'other').length },
  ].filter((d) => d.value > 0)

  // Class size data
  const classSizeData = classes.map((cls) => ({
    name: cls.name,
    아동수: children.filter((c) => c.class_id === cls.id).length,
  }))

  const summary = {
    total: children.length,
    active: children.filter((c) => c.status === 'active').length,
    totalActivities: activities.length,
    completedActivities: activities.filter((a) => a.status === 'completed').length,
  }

  return (
    <>
      <Header title="보고서" subtitle="시설 운영 현황 분석 리포트" />
      <div className="flex-1 p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '전체 아동', value: summary.total, sub: `재원 ${summary.active}명` },
            { label: '재원율', value: summary.total > 0 ? `${Math.round(summary.active / summary.total * 100)}%` : '—', sub: '현재 기준' },
            { label: '전체 활동', value: summary.totalActivities, sub: '등록된 프로그램' },
            { label: '완료 활동', value: summary.completedActivities, sub: `${summary.totalActivities > 0 ? Math.round(summary.completedActivities / summary.totalActivities * 100) : 0}% 완료율` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-xs text-[#666666] mb-1">{s.label}</p>
                <p className="text-2xl font-semibold text-[#f5f5f5]">{s.value}</p>
                <p className="text-xs text-[#555555] mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <ReportsCharts
          monthlyData={monthlyData}
          activityTypeData={activityTypeData}
          classSizeData={classSizeData}
        />
      </div>
    </>
  )
}
