import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { ChildrenClient } from '@/components/features/children/ChildrenClient'
import { ClassesClient } from '@/components/features/classes/ClassesClient'
import { FacilitySchemaGraph } from '@/components/features/children/FacilitySchemaGraph'
import { RosterDock } from '@/components/features/children/RosterDock'
import { Users, BookOpen } from 'lucide-react'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [childrenRes, classListRes, classesFullRes, staffRes, allChildrenRes, centerRes] = await Promise.all([
    supabase.from('children').select('*, classes(id, name)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('classes').select('*, children(id, name, gender, status)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('children').select('id, name, class_id, status').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('centers').select('name').eq('id', cid).maybeSingle(),
  ])

  const allKids = (allChildrenRes.data ?? []) as { id: string; name: string; class_id: string | null; status: string }[]
  const unassigned = allKids.filter((c) => !c.class_id).map((c) => ({ id: c.id, name: c.name, status: c.status }))

  return (
    <>
      <div className="flex-1 min-h-0 p-3 w-full overflow-hidden flex flex-col gap-3">
        {/* Schema graph hero — facility → classes → children */}
        <div className="flex-1 min-h-0">
          <FacilitySchemaGraph
            facilityName={centerRes.data?.name ?? '우리 시설'}
            classes={(classesFullRes.data ?? []) as never[]}
            unassigned={unassigned}
          />
        </div>

        {/* Collapsible detailed lists (search inside each client) */}
        <RosterDock>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 h-full min-h-0">
            <section className="min-w-0 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <Users size={14} className="text-accent" />
                <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">아동 관리 체계</h2>
              </div>
              <ChildrenClient initialChildren={childrenRes.data ?? []} classes={classListRes.data ?? []} centerId={cid} />
            </section>
            <section className="min-w-0 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <BookOpen size={14} className="text-accent" />
                <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">반 관리 체계</h2>
              </div>
              <ClassesClient initialClasses={classesFullRes.data ?? []} staff={staffRes.data ?? []} allChildren={allChildrenRes.data ?? []} centerId={cid} />
            </section>
          </div>
        </RosterDock>
      </div>
    </>
  )
}
