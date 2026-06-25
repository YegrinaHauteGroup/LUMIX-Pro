import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ClassesClient } from '@/components/features/classes/ClassesClient'

export default async function ClassesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [classesRes, staffRes, childrenRes] = await Promise.all([
    supabase.from('classes').select('*, children(id, name, gender, status)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('children').select('id, name, class_id, status').eq('center_id', cid).is('deleted_at', null).order('name'),
  ])

  return (
    <>
      <Header title="반 관리" subtitle="반 구성 및 아동 배정 관리" />
      <ClassesClient
        initialClasses={classesRes.data ?? []}
        staff={staffRes.data ?? []}
        allChildren={childrenRes.data ?? []}
        centerId={cid}
      />
    </>
  )
}
