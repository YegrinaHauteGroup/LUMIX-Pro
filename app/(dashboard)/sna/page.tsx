import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SnaClient } from '@/components/features/sna/SnaClient'

interface SnaNode {
  child_id: string
  name: string
  class_id: string | null
  connection_count: number
}

interface SnaEdge {
  source_id: string
  target_id: string
  strength: number
}

export default async function SnaPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const [snaRes, classesRes] = await Promise.all([
    supabase.rpc('get_sna_graph', { p_center_id: centerId ?? '' }),
    supabase.from('classes').select('id, name').eq('center_id', centerId ?? ''),
  ])

  const snaData = snaRes.data as { nodes: SnaNode[]; edges: SnaEdge[] } | null

  return (
    <>
      <Header title="SNA 분석" subtitle="아동 간 사회적 관계망을 시각화합니다" />
      <SnaClient
        nodes={snaData?.nodes ?? []}
        edges={snaData?.edges ?? []}
        classes={classesRes.data ?? []}
      />
    </>
  )
}
