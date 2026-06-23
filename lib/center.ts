import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

/**
 * Resolve the active center for the signed-in user.
 *
 * Order matters: RLS on every table is scoped to the user's staff_profiles
 * center (current_user_center_id()), so that MUST be the primary source —
 * otherwise the app would query a center the user cannot actually read and
 * everything would come back empty.
 */
export async function getCenterId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. RLS-authoritative: the staff profile's center for this user.
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('center_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  if (staff?.center_id) return staff.center_id

  // 2. Explicit metadata override.
  const metaId = user.user_metadata?.center_id || user.app_metadata?.center_id
  if (metaId) return metaId

  // 3. First readable center (legacy fallback).
  const { data: existing } = await supabase
    .from('centers')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return existing?.id ?? null
}

export interface CenterInfo {
  id: string
  name: string
}

export async function getCenterInfo(): Promise<CenterInfo | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const id = await getCenterId()
  if (!id) return null

  const { data } = await supabase.from('centers').select('id, name').eq('id', id).maybeSingle()
  return data ?? null
}
