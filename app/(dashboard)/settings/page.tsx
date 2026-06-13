import { Header } from '@/components/layout/Header'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { SettingsClient } from '@/components/features/settings/SettingsClient'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Header title="설정" subtitle="계정 및 시스템 설정" />
      <SettingsClient user={user} />
    </>
  )
}
