import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SnaClient } from '@/components/features/sna/SnaClient'
import { SnaAnalyticsDock } from '@/components/features/sna/SnaAnalyticsDock'

export default async function SnaPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [snaRes, insightsRes, classesRes, threatsRes,
    childrenRes, staffRes, guardiansRes, rulesRes, peerRes, staffAsmtRes, guardianAsmtRes] = await Promise.all([
    supabase.rpc('get_sna_graph', { p_center_id: cid }),
    supabase.rpc('get_sna_insights', { p_center_id: cid }),
    supabase.from('classes').select('id, name').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.rpc('get_threats', { p_center_id: cid }),
    supabase.from('children').select('id, name').eq('center_id', cid).eq('status', 'active').is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('guardian_profiles').select('id, guardian_name, guardian_phone').eq('center_id', cid).is('deleted_at', null).order('guardian_name'),
    supabase.from('sna_label_rules').select('*').eq('active', true).or(`center_id.eq.${cid},center_id.is.null`),
    supabase.from('peer_assessments').select('id, from_child_id, to_child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
    supabase.from('staff_child_assessments').select('id, staff_id, child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
    supabase.from('guardian_child_assessments').select('id, guardian_profile_id, guardian_name, child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
  ])

  const snaData = snaRes.data as { nodes: unknown[]; edges: unknown[] } | null

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          <SnaClient
            centerId={cid}
            nodes={(snaData?.nodes as never[]) ?? []}
            edges={(snaData?.edges as never[]) ?? []}
            insights={insightsRes.data ?? null}
            classes={classesRes.data ?? []}
          />
        </div>
        <SnaAnalyticsDock
          centerId={cid}
          threats={threatsRes.data ?? null}
          assess={{
            centerId: cid,
            children: childrenRes.data ?? [],
            staff: staffRes.data ?? [],
            guardians: guardiansRes.data ?? [],
            rules: rulesRes.data ?? [],
            peerAssessments: peerRes.data ?? [],
            staffAssessments: staffAsmtRes.data ?? [],
            guardianAssessments: guardianAsmtRes.data ?? [],
          }}
        />
      </div>
    </>
  )
}
