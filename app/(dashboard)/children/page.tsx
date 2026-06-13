import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ChildrenClient } from '@/components/features/children/ChildrenClient'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [childrenRes, classesRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').order('name'),
    supabase.from('classes').select('id, name'),
  ])

  return (
    <>
      <Header title="아동 관리" subtitle="등록된 아동 목록을 조회하고 관리합니다" />
      <ChildrenClient
        initialChildren={childrenRes.data ?? []}
        classes={classesRes.data ?? []}
      />
    </>
  )
}
