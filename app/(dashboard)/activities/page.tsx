import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ActivitiesClient } from '@/components/features/activities/ActivitiesClient'

export default async function ActivitiesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [activitiesRes, classesRes, childrenRes, partRes, ctxRes] = await Promise.all([
    supabase.from('activities').select('*, classes(id, name)').eq('center_id', cid).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null),
    supabase.from('children').select('id, name, class_id, status').eq('center_id', cid).eq('status', 'active').is('deleted_at', null).order('name'),
    supabase.from('activity_participations').select('activity_id, child_id').eq('center_id', cid).is('deleted_at', null),
    supabase.from('interactions').select('source_id, target_id, label, relation_type, context_activity_id').eq('center_id', cid).is('deleted_at', null).not('context_activity_id', 'is', null),
  ])

  return (
    <>
      <Header title="활동 관리" subtitle="프로그램·현장학습·이벤트 · SNA 연계 참여 관리" />
      <ActivitiesClient
        initialActivities={activitiesRes.data ?? []}
        classes={classesRes.data ?? []}
        allChildren={childrenRes.data ?? []}
        participations={partRes.data ?? []}
        contextEdges={ctxRes.data ?? []}
        centerId={cid}
      />
    </>
  )
}
