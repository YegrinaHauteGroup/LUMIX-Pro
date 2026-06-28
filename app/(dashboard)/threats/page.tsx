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
      <ThreatsClient centerId={cid} initial={data ?? null} />
    </>
  )
}
