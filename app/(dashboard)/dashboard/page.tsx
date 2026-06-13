import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import {
  Users,
  BookOpen,
  CalendarDays,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardCharts } from '@/components/features/dashboard/DashboardCharts'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS, ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_COLORS } from '@/lib/utils'
import type { Child, Activity, Class } from '@/lib/types'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [childrenRes, activitiesRes, classesRes] = await Promise.all([
    supabase.from('children').select('*').order('created_at', { ascending: false }),
    supabase.from('activities').select('*, classes(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('classes').select('*, children(id)'),
  ])

  const children: Child[] = childrenRes.data ?? []
  const activities: Activity[] = activitiesRes.data ?? []
  const classes: Class[] = classesRes.data ?? []

  const activeChildren = children.filter((c) => c.status === 'active').length
  const totalChildren = children.length
  const plannedActivities = activities.filter((a) => a.status === 'planned').length
  const recentChildren = children.slice(0, 5)
  const upcomingActivities = activities.filter((a) => a.status === 'planned').slice(0, 5)

  const stats = [
    {
      label: '전체 아동',
      value: totalChildren,
      sub: `재원 ${activeChildren}명`,
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-400/10',
    },
    {
      label: '운영 반',
      value: classes.length,
      sub: `총 정원 ${classes.reduce((acc, c) => acc + (c.capacity ?? 0), 0)}명`,
      icon: BookOpen,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: '전체 활동',
      value: activities.length,
      sub: `예정 ${plannedActivities}개`,
      icon: CalendarDays,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: '재원율',
      value: totalChildren > 0 ? `${Math.round((activeChildren / totalChildren) * 100)}%` : '—',
      sub: '전월 대비',
      icon: TrendingUp,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
    },
  ]

  const genderStats = [
    { name: '남아', value: children.filter((c) => c.gender === 'male').length },
    { name: '여아', value: children.filter((c) => c.gender === 'female').length },
    { name: '기타', value: children.filter((c) => c.gender === 'other').length },
  ].filter((s) => s.value > 0)

  const statusStats = [
    { name: '재원', value: children.filter((c) => c.status === 'active').length },
    { name: '휴원', value: children.filter((c) => c.status === 'leave').length },
    { name: '퇴원', value: children.filter((c) => c.status === 'inactive').length },
  ].filter((s) => s.value > 0)

  const classStats = classes.map((cls) => ({
    name: cls.name,
    value: (cls.children as { id: string }[] | undefined)?.length ?? 0,
  }))

  return (
    <>
      <Header
        title="대시보드"
        subtitle="시설 현황 한눈에 보기"
      />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#666666] mb-1">{stat.label}</p>
                    <p className="text-2xl font-semibold text-[#f5f5f5]">{stat.value}</p>
                    <p className="text-xs text-[#555555] mt-1">{stat.sub}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon size={17} className={stat.color} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4">
          <DashboardCharts
            genderStats={genderStats}
            statusStats={statusStats}
            classStats={classStats}
          />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Recent children */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>최근 등록 아동</CardTitle>
                <Link href="/children" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  전체보기 <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentChildren.length === 0 ? (
                <p className="text-sm text-[#444444] py-4 text-center">등록된 아동이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {recentChildren.map((child) => (
                    <Link
                      key={child.id}
                      href={`/children/${child.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">
                        <span className="text-xs text-indigo-400 font-medium">
                          {child.name[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#e0e0e0] font-medium truncate">{child.name}</p>
                        <p className="text-xs text-[#555555]">
                          {child.gender === 'male' ? '남' : child.gender === 'female' ? '여' : '기타'}
                        </p>
                      </div>
                      <Badge className={CHILD_STATUS_COLORS[child.status]}>
                        {CHILD_STATUS_LABELS[child.status]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming activities */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>예정된 활동</CardTitle>
                <Link href="/activities" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  전체보기 <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingActivities.length === 0 ? (
                <p className="text-sm text-[#444444] py-4 text-center">예정된 활동이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {upcomingActivities.map((activity) => (
                    <Link
                      key={activity.id}
                      href={`/activities`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                    >
                      <div className={`w-1.5 h-8 rounded-full ${ACTIVITY_TYPE_COLORS[activity.type]?.split(' ')[1] ?? 'bg-gray-400/10'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#e0e0e0] font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-[#555555]">
                          {activity.activity_date ?? '날짜 미정'} {activity.activity_time ? `• ${activity.activity_time}` : ''}
                        </p>
                      </div>
                      <Badge className={ACTIVITY_TYPE_COLORS[activity.type]}>
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
