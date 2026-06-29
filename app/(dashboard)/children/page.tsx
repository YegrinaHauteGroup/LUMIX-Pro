import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { ChildrenClient } from '@/components/features/children/ChildrenClient'
import { ClassesClient } from '@/components/features/classes/ClassesClient'
import { FacilitySchemaGraph } from '@/components/features/children/FacilitySchemaGraph'
import { RosterDock } from '@/components/features/children/RosterDock'
import { fetchChildrenPageData } from '@/lib/data/children'
import { Users, BookOpen } from 'lucide-react'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const { children, classList, classesFull, staff, allChildren, centerName, unassigned } =
    await fetchChildrenPageData(supabase, cid)

  return (
    <>
      <div className="flex-1 min-h-0 p-3 w-full overflow-hidden flex flex-col gap-3">
        {/* Schema graph hero — facility → classes → children */}
        <div className="flex-1 min-h-0">
          <FacilitySchemaGraph
            facilityName={centerName ?? '우리 시설'}
            classes={classesFull as never[]}
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
              <ChildrenClient initialChildren={children} classes={classList} centerId={cid} />
            </section>
            <section className="min-w-0 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <BookOpen size={14} className="text-accent" />
                <h2 className="text-[12px] font-semibold text-ink uppercase tracking-[0.1em]">반 관리 체계</h2>
              </div>
              <ClassesClient initialClasses={classesFull as never[]} staff={staff} allChildren={allChildren} centerId={cid} />
            </section>
          </div>
        </RosterDock>
      </div>
    </>
  )
}
