import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { ChildrenClient } from '@/components/features/children/ChildrenClient'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const [childrenRes, classesRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('center_id', centerId ?? '').order('name'),
    supabase.from('classes').select('id, name').eq('center_id', centerId ?? ''),
  ])

  return (
    <>
      <Header title="아동 관리" subtitle="등록된 아동 목록 조회 및 관리" />
      <ChildrenClient
        initialChildren={childrenRes.data ?? []}
        classes={classesRes.data ?? []}
        centerId={centerId ?? ''}
      />
    </>
  )
}
