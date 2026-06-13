import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { AttendanceClient } from '@/components/features/attendance/AttendanceClient'

export default async function AttendancePage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const today = new Date().toISOString().split('T')[0]

  const [childrenRes, classesRes] = await Promise.all([
    supabase.from('children').select('id, name, class_id, classes(id, name)').eq('status', 'active').order('name'),
    supabase.from('classes').select('id, name'),
  ])

  return (
    <>
      <Header title="출석 관리" subtitle="일별 출석 현황을 기록하고 조회합니다" />
      <AttendanceClient
        children={(childrenRes.data ?? []) as any}
        classes={classesRes.data ?? []}
        today={today}
      />
    </>
  )
}
