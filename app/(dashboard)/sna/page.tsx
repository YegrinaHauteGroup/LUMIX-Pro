import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SnaClient } from '@/components/features/sna/SnaClient'

export default async function SnaPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [snaRes, insightsRes, classesRes] = await Promise.all([
    supabase.rpc('get_sna_graph', { p_center_id: cid }),
    supabase.rpc('get_sna_insights', { p_center_id: cid }),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null).order('name'),
  ])

  const snaData = snaRes.data as { nodes: unknown[]; edges: unknown[] } | null

  return (
    <>
      <Header title="객체 그래프 · Vertex" subtitle="온톨로지 Object Graph · Force-Directed 탐색 · 시뮬레이션" />
      <SnaClient
        centerId={cid}
        nodes={(snaData?.nodes as never[]) ?? []}
        edges={(snaData?.edges as never[]) ?? []}
        insights={insightsRes.data ?? null}
        classes={classesRes.data ?? []}
      />
    </>
  )
}
