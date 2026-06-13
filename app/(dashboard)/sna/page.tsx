import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SnaClient } from '@/components/features/sna/SnaClient'

export default async function SnaPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [childrenRes, classesRes, activitiesRes] = await Promise.all([
    supabase.from('children').select('id, name, class_id, status').eq('status', 'active'),
    supabase.from('classes').select('id, name'),
    supabase.from('activities').select('id, title, class_id, type'),
  ])

  return (
    <>
      <Header
        title="SNA 분석"
        subtitle="아동 간 사회적 관계망을 시각화합니다"
      />
      <SnaClient
        children={childrenRes.data ?? []}
        classes={classesRes.data ?? []}
        activities={activitiesRes.data ?? []}
      />
    </>
  )
}
