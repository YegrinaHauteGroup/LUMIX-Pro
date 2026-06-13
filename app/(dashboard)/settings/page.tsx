import { Header } from '@/components/layout/Header'
import { getCenterInfo } from '@/lib/center'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SettingsClient } from '@/components/features/settings/SettingsClient'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [{ data: { user } }, center] = await Promise.all([
    supabase.auth.getUser(),
    getCenterInfo(),
  ])

  return (
    <>
      <Header title="설정" subtitle="계정 및 시설 설정" />
      <SettingsClient user={user} center={center} />
    </>
  )
}
