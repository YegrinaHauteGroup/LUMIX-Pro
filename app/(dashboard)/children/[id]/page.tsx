import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ChildDetailClient } from '@/components/features/children/ChildDetailClient'

interface Props {
  params: { id: string }
}

export default async function ChildDetailPage({ params }: Props) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [childRes, classesRes, activitiesRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('id', params.id).single(),
    supabase.from('classes').select('id, name'),
    supabase.from('activities').select('*, classes(name)').order('created_at', { ascending: false }).limit(20),
  ])

  if (!childRes.data) notFound()

  return (
    <>
      <Header
        title={childRes.data.name}
        subtitle="아동 상세 정보"
      />
      <ChildDetailClient
        child={childRes.data}
        classes={classesRes.data ?? []}
        recentActivities={activitiesRes.data ?? []}
      />
    </>
  )
}
