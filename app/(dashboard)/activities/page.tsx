import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ActivitiesClient } from '@/components/features/activities/ActivitiesClient'

export default async function ActivitiesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const [activitiesRes, classesRes] = await Promise.all([
    supabase.from('activities').select('*, classes(id, name)')
      .eq('center_id', centerId ?? '').order('created_at', { ascending: false }),
    supabase.from('classes').select('id, name').eq('center_id', centerId ?? ''),
  ])

  return (
    <>
      <Header title="활동 관리" subtitle="프로그램 및 활동 일정 관리" />
      <ActivitiesClient
        initialActivities={activitiesRes.data ?? []}
        classes={classesRes.data ?? []}
        centerId={centerId ?? ''}
      />
    </>
  )
}
