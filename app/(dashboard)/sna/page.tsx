import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SnaClient } from '@/components/features/sna/SnaClient'

interface SnaNode {
  child_id: string
  name: string
  class_id: string | null
  class_name: string | null
  connection_count: number
  weighted_degree: number
  in_degree: number
  out_degree: number
  betweenness: number
  closeness: number
  eigenvector: number
  clustering: number
  degree_centrality: number
  community_id: number | null
  is_isolated: boolean
}

interface SnaEdge {
  source_id: string
  target_id: string
  strength: number
  relation_types: string[]
  has_conflict: boolean
}

export default async function SnaPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const [snaRes, insightsRes, classesRes] = await Promise.all([
    supabase.rpc('get_sna_graph', { p_center_id: centerId ?? '' }),
    supabase.rpc('get_sna_insights', { p_center_id: centerId ?? '' }),
    supabase.from('classes').select('id, name').eq('center_id', centerId ?? ''),
  ])

  const snaData = snaRes.data as { nodes: SnaNode[]; edges: SnaEdge[] } | null

  return (
    <>
      <Header title="SNA 분석" subtitle="온톨로지 기반 아동 관계망 · 중심성 · 커뮤니티 분석" />
      <SnaClient
        centerId={centerId ?? ''}
        nodes={snaData?.nodes ?? []}
        edges={snaData?.edges ?? []}
        insights={insightsRes.data ?? null}
        classes={classesRes.data ?? []}
      />
    </>
  )
}
