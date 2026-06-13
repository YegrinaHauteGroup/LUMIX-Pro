import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { ClassesClient } from '@/components/features/classes/ClassesClient'

export default async function ClassesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()

  const { data: classes } = await supabase
    .from('classes')
    .select('*, children(id, name, gender, status)')
    .eq('center_id', centerId ?? '')
    .order('name')

  return (
    <>
      <Header title="반 관리" subtitle="반 구성 및 아동 배정 관리" />
      <ClassesClient initialClasses={classes ?? []} centerId={centerId ?? ''} />
    </>
  )
}
