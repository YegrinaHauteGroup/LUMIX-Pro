import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function getCenterId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Try user metadata first
  const metaId = user.user_metadata?.center_id || user.app_metadata?.center_id
  if (metaId) return metaId

  // 2. Fall back: fetch first center from DB
  const { data: centers } = await supabase
    .from('centers')
    .select('id')
    .limit(1)
    .single()

  return centers?.id ?? null
}
