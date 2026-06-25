import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ThreatsClient } from '@/components/features/threats/ThreatsClient'

export default async function ThreatsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const { data } = await supabase.rpc('get_threats', { p_center_id: cid })

  return (
    <>
      <Header title="위협 탐지 시스템" subtitle="SNA · 보건 · 위치 기반 실시간 위협 감지" />
      <ThreatsClient centerId={cid} initial={data ?? null} />
    </>
  )
}
