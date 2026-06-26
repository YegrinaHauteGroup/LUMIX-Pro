import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { ChildrenClient } from '@/components/features/children/ChildrenClient'
import { ClassesClient } from '@/components/features/classes/ClassesClient'
import { Users, BookOpen } from 'lucide-react'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [childrenRes, classListRes, classesFullRes, staffRes, allChildrenRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('*, children(id, name, gender, status)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('children').select('id, name, class_id, status').eq('center_id', cid).is('deleted_at', null).order('name'),
  ])

  return (
    <>
      <Header title="아동·반 통합 관리" subtitle="아동 관리 체계 · 반 관리 체계" />
      <div className="flex-1 min-h-0 p-4 w-full overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full min-h-0">
          {/* Left — 아동 관리 체계 */}
          <section className="min-w-0 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2.5 shrink-0">
              <Users size={14} className="text-accent" />
              <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">아동 관리 체계</h2>
            </div>
            <ChildrenClient
              initialChildren={childrenRes.data ?? []}
              classes={classListRes.data ?? []}
              centerId={cid}
            />
          </section>

          {/* Right — 반 관리 체계 */}
          <section className="min-w-0 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2.5 shrink-0">
              <BookOpen size={14} className="text-accent" />
              <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">반 관리 체계</h2>
            </div>
            <ClassesClient
              initialClasses={classesFullRes.data ?? []}
              staff={staffRes.data ?? []}
              allChildren={allChildrenRes.data ?? []}
              centerId={cid}
            />
          </section>
        </div>
      </div>
    </>
  )
}
