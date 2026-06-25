import { Header } from '@/components/layout/Header'
import { getCenterId } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { QuestsClient } from '@/components/features/quests/QuestsClient'

export default async function QuestsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const cid = centerId ?? ''

  const [questsRes, insightsRes, classesRes, staffRes, entRes] = await Promise.all([
    supabase.from('analysis_quests').select('id, title, quest_type, params, status, result, error, created_at, updated_at')
      .eq('center_id', cid).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
    supabase.rpc('get_sna_insights', { p_center_id: cid }),
    supabase.from('classes').select('id, name, children(id)').eq('center_id', cid).is('deleted_at', null).order('name'),
    supabase.from('staff_profiles').select('id').eq('center_id', cid).is('deleted_at', null),
    supabase.from('sna_entities').select('id, kind').eq('center_id', cid).is('deleted_at', null),
  ])

  const classes = (classesRes.data ?? []).map((c: { id: string; name: string; children?: { id: string }[] }) => ({
    id: c.id, name: c.name, count: c.children?.length ?? 0,
  }))

  return (
    <>
      <Header title="퀘스트 분석 엔진" subtitle="파이프라인 분석 · 시뮬레이션 · 실행" />
      <QuestsClient
        centerId={cid}
        initialQuests={questsRes.data ?? []}
        insights={insightsRes.data ?? null}
        classes={classes}
        staffCount={(staffRes.data ?? []).length}
        entityCount={(entRes.data ?? []).length}
      />
    </>
  )
}
