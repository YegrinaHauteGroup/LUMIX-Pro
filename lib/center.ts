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

  // 2. Try first existing center in DB
  const { data: existing } = await supabase
    .from('centers')
    .select('id')
    .limit(1)
    .single()

  if (existing?.id) return existing.id

  // 3. Auto-create a default center for this user on first use
  const { data: created } = await supabase
    .from('centers')
    .insert({ name: '기본 시설' })
    .select('id')
    .single()

  return created?.id ?? null
}

export interface CenterInfo {
  id: string
  name: string
}

export async function getCenterInfo(): Promise<CenterInfo | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const metaId = user.user_metadata?.center_id || user.app_metadata?.center_id

  if (metaId) {
    const { data } = await supabase.from('centers').select('id, name').eq('id', metaId).single()
    if (data) return data
  }

  // Fetch or auto-create
  const { data: existing } = await supabase.from('centers').select('id, name').limit(1).single()
  if (existing) return existing

  const { data: created } = await supabase
    .from('centers')
    .insert({ name: '기본 시설' })
    .select('id, name')
    .single()

  return created ?? null
}
