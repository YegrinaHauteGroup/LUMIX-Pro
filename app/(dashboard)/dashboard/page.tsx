import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { Users, BookOpen, CalendarDays, TrendingUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { DashboardCharts } from '@/components/features/dashboard/DashboardCharts'
import { DashboardFeed } from '@/components/features/dashboard/DashboardFeed'
import { DashboardCalendar } from '@/components/features/dashboard/DashboardCalendar'
import { CHILD_STATUS_COLORS, CHILD_STATUS_LABELS, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from '@/lib/utils'
import type { Child, Activity, Class } from '@/lib/types'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const since = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)
  const [childrenRes, activitiesRes, classesRes, centerRes, attRes, insightsRes, calActRes, careRes] = await Promise.all([
    supabase.from('children').select('*').eq('center_id', centerId ?? '').order('created_at', { ascending: false }),
    supabase.from('activities').select('*, classes(name)').eq('center_id', centerId ?? '').order('created_at', { ascending: false }).limit(10),
    supabase.from('classes').select('*, children(id)').eq('center_id', centerId ?? ''),
    supabase.from('centers').select('latitude, longitude').eq('id', centerId ?? '').maybeSingle(),
    supabase.from('attendances').select('attendance_date, status').eq('center_id', centerId ?? '').gte('attendance_date', since).is('deleted_at', null),
    supabase.rpc('get_sna_insights', { p_center_id: centerId ?? '' }),
    supabase.from('activities').select('id, title, type, status, activity_date, activity_time').eq('center_id', centerId ?? '').is('deleted_at', null).not('activity_date', 'is', null),
    supabase.from('care_notes').select('id, child_id, content, noted_on, note_type, children(name)').eq('center_id', centerId ?? '').is('deleted_at', null).order('noted_on', { ascending: false }).limit(120),
  ])
  const hasLocation = centerRes.data?.latitude != null && centerRes.data?.longitude != null

  const children: Child[] = childrenRes.data ?? []
  const activities: Activity[] = activitiesRes.data ?? []
  const classes: Class[] = classesRes.data ?? []

  // 14-day attendance trend
  const attRows = (attRes.data ?? []) as { attendance_date: string; status: string }[]
  const attendanceTrend = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10)
    const day = attRows.filter((r) => r.attendance_date === d)
    return {
      date: d.slice(5),
      출석: day.filter((r) => r.status === 'present').length,
      지각: day.filter((r) => r.status === 'late').length,
      결석: day.filter((r) => r.status === 'absent').length,
    }
  })

  // age distribution
  const ageOf = (b: string | null) => {
    if (!b) return null
    const t = new Date(); const bd = new Date(b)
    let a = t.getFullYear() - bd.getFullYear()
    if (t.getMonth() < bd.getMonth() || (t.getMonth() === bd.getMonth() && t.getDate() < bd.getDate())) a--
    return a
  }
  const ageMap = new Map<number, number>()
  children.filter((c) => c.status === 'active').forEach((c) => { const a = ageOf(c.birth_date); if (a != null) ageMap.set(a, (ageMap.get(a) ?? 0) + 1) })
  const ageStats = [...ageMap.entries()].sort((a, b) => a[0] - b[0]).map(([age, value]) => ({ name: `${age}세`, value }))

  // SNA summary
  const ins = (insightsRes.data ?? {}) as {
    summary?: { children: number; isolated: number; communities: number; avg_betweenness: number }
    allergy_children?: unknown[]; conflict_children?: unknown[]; health_alerts?: unknown[]
  }
  const snaStats = [
    { label: '분석 아동', value: ins.summary?.children ?? 0 },
    { label: '고립 신호', value: ins.summary?.isolated ?? 0 },
    { label: '갈등 관계', value: ins.conflict_children?.length ?? 0 },
    { label: '보건 경보', value: ins.health_alerts?.length ?? 0 },
    { label: '알러지 관리', value: ins.allergy_children?.length ?? 0 },
    { label: '커뮤니티', value: ins.summary?.communities ?? 0 },
  ]

  const activeChildren = children.filter((c) => c.status === 'active').length
  const totalChildren = children.length
  const plannedActivities = activities.filter((a) => a.status === 'planned').length
  const recentChildren = children.slice(0, 5)
  const upcomingActivities = activities.filter((a) => a.status === 'planned').slice(0, 5)

  const stats = [
    { label: '전체 아동', value: totalChildren, sub: `재원 ${activeChildren}명`, icon: Users },
    { label: '운영 반', value: classes.length, sub: `총 정원 ${classes.reduce((acc, c) => acc + (c.capacity ?? 0), 0)}명`, icon: BookOpen },
    { label: '전체 활동', value: activities.length, sub: `예정 ${plannedActivities}개`, icon: CalendarDays },
    {
      label: '재원율',
      value: totalChildren > 0 ? `${Math.round((activeChildren / totalChildren) * 100)}%` : '—',
      sub: '현재 기준',
      icon: TrendingUp,
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
      <Header title="대시보드" subtitle="시설 현황 한눈에 보기" />
      <div className="flex-1 p-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface border border-line rounded-xl shadow-[var(--shadow-card)] px-4 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-ink-faint uppercase tracking-[0.12em] mb-2">{stat.label}</p>
                  <p className="text-2xl font-semibold text-ink tracking-[-0.02em]">{stat.value}</p>
                  <p className="text-[10px] text-ink-ghost mt-1">{stat.sub}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
                  <stat.icon size={15} className="text-accent" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Location-based feed (#4) */}
        <DashboardFeed centerId={centerId ?? ''} hasLocation={hasLocation} />

        {/* Calendar (#8) */}
        <DashboardCalendar
          centerId={centerId ?? ''}
          initialActivities={(calActRes.data ?? []) as never[]}
          careNotes={((careRes.data ?? []) as unknown as { id: string; child_id: string; content: string; noted_on: string; note_type: string; children: { name: string } | null }[])
            .map((c) => ({ id: c.id, child_id: c.child_id, content: c.content, noted_on: c.noted_on, note_type: c.note_type, child_name: c.children?.name ?? '아동' }))}
        />

        {/* Analytics */}
        <DashboardCharts
          genderStats={genderStats}
          statusStats={statusStats}
          classStats={classStats}
          ageStats={ageStats}
          attendanceTrend={attendanceTrend}
          snaStats={snaStats}
        />

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Recent children */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>최근 등록 아동</CardTitle>
                <Link href="/children" className="text-[10px] text-[#7a8499] hover:text-[#5a6678] flex items-center gap-1 transition-colors uppercase tracking-widest">
                  전체보기 <ArrowRight size={10} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentChildren.length === 0 ? (
                <p className="text-[12px] text-[#aab2c2] py-4 text-center">등록된 아동이 없습니다</p>
              ) : (
                <div className="space-y-1">
                  {recentChildren.map((child) => (
                    <Link key={child.id} href={`/children/${child.id}`}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#f3f6fb] transition-colors">
                      <div className="w-6 h-6 bg-[#f1f4f9] border border-[#e6eaf2] flex items-center justify-center shrink-0">
                        <span className="text-[9px] text-[#7a8499]">{child.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#1c2740] font-medium truncate">{child.name}</p>
                        <p className="text-[10px] text-[#8a93a6]">
                          {child.gender === 'male' ? '남' : child.gender === 'female' ? '여' : '기타'}
                        </p>
                      </div>
                      <Badge className={CHILD_STATUS_COLORS[child.status]}>{CHILD_STATUS_LABELS[child.status]}</Badge>
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
                <Link href="/activities" className="text-[10px] text-[#7a8499] hover:text-[#5a6678] flex items-center gap-1 transition-colors uppercase tracking-widest">
                  전체보기 <ArrowRight size={10} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingActivities.length === 0 ? (
                <p className="text-[12px] text-[#aab2c2] py-4 text-center">예정된 활동이 없습니다</p>
              ) : (
                <div className="space-y-1">
                  {upcomingActivities.map((activity) => (
                    <Link key={activity.id} href="/activities"
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#f3f6fb] transition-colors">
                      <div className={`w-1 h-8 rounded-full ${ACTIVITY_TYPE_COLORS[activity.type]?.split(' ')[1] ?? 'bg-slate-100'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#1c2740] font-medium truncate">{activity.title}</p>
                        <p className="text-[10px] text-[#8a93a6]">
                          {activity.activity_date ?? '날짜 미정'}{activity.activity_time ? ` · ${activity.activity_time}` : ''}
                        </p>
                      </div>
                      <Badge className={ACTIVITY_TYPE_COLORS[activity.type]}>{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
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
