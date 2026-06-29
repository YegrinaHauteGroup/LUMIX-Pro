import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { AttendanceClient } from '@/components/features/attendance/AttendanceClient'

export default async function AttendancePage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const today = new Date().toISOString().split('T')[0]

  const [childrenRes, classesRes] = await Promise.all([
    supabase.from('children').select('id, name, class_id, classes(id, name)')
      .eq('center_id', centerId ?? '').eq('status', 'active').order('name'),
    supabase.from('classes').select('id, name').eq('center_id', centerId ?? ''),
  ])

  return (
    <>
      <AttendanceClient
        children={(childrenRes.data ?? []) as any}
        classes={classesRes.data ?? []}
        today={today}
        centerId={centerId ?? ''}
      />
    </>
  )
}
