import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { AssessmentsClient } from '@/components/features/assessments/AssessmentsClient'

export default async function AssessmentsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [childrenRes, staffRes, guardiansRes, rulesRes, peerRes, staffAsmtRes, guardianAsmtRes] =
    await Promise.all([
      supabase.from('children').select('id, name').eq('center_id', cid).eq('status', 'active').is('deleted_at', null).order('name'),
      supabase.from('staff_profiles').select('id, name, role').eq('center_id', cid).is('deleted_at', null).order('name'),
      supabase.from('guardian_profiles').select('id, guardian_name, guardian_phone').eq('center_id', cid).is('deleted_at', null).order('guardian_name'),
      supabase.from('sna_label_rules').select('*').eq('active', true).or(`center_id.eq.${cid},center_id.is.null`),
      supabase.from('peer_assessments').select('id, from_child_id, to_child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
      supabase.from('staff_child_assessments').select('id, staff_id, child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
      supabase.from('guardian_child_assessments').select('id, guardian_profile_id, guardian_name, child_id, dimension, score, assessed_on, notes').eq('center_id', cid).is('deleted_at', null).order('assessed_on', { ascending: false }).limit(20),
    ])

  return (
    <>
      <AssessmentsClient
        centerId={cid}
        children={childrenRes.data ?? []}
        staff={staffRes.data ?? []}
        guardians={guardiansRes.data ?? []}
        rules={rulesRes.data ?? []}
        peerAssessments={peerRes.data ?? []}
        staffAssessments={staffAsmtRes.data ?? []}
        guardianAssessments={guardianAsmtRes.data ?? []}
      />
    </>
  )
}
