import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChildDetailClient } from '@/components/features/children/ChildDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChildDetailPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [childRes, classesRes, staffRes, healthRes, linksRes, guardiansRes, activitiesRes, eventsRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('id', id).single(),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null),
    supabase.from('staff_profiles').select('id, name').eq('center_id', cid).is('deleted_at', null),
    supabase.from('health_profiles').select('*').eq('child_id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('child_guardians').select('*, guardian_profiles(id, guardian_name, guardian_phone)').eq('child_id', id).is('deleted_at', null),
    supabase.from('guardian_profiles').select('id, guardian_name, guardian_phone').eq('center_id', cid).is('deleted_at', null).order('guardian_name'),
    supabase.from('activities').select('*, classes(name)').order('created_at', { ascending: false }).limit(20),
    supabase.from('health_events').select('id, event_date, kind, domain, code, label, severity, status, contagious, note').eq('child_id', id).is('deleted_at', null).order('event_date', { ascending: false }).limit(50),
  ])

  if (!childRes.data) notFound()

  return (
    <>
      <Header title={childRes.data.name} subtitle="아동 온톨로지 프로필" />
      <ChildDetailClient
        child={childRes.data}
        centerId={cid}
        classes={classesRes.data ?? []}
        staff={staffRes.data ?? []}
        health={healthRes.data ?? null}
        links={linksRes.data ?? []}
        guardians={guardiansRes.data ?? []}
        recentActivities={activitiesRes.data ?? []}
        healthEvents={eventsRes.data ?? []}
      />
    </>
  )
}
