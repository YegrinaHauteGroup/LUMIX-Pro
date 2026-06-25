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

  const { data: quests } = await supabase
    .from('analysis_quests')
    .select('id, title, quest_type, status, result, error, created_at, updated_at')
    .eq('center_id', cid)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <>
      <Header title="퀘스트 분석 엔진" subtitle="분석 과제 정의 · Edge Function 실행 · 결과 누적" />
      <QuestsClient centerId={cid} initialQuests={quests ?? []} />
    </>
  )
}
