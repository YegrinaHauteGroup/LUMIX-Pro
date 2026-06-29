'use client'

// Subscribe a list view to Postgres changes for its center and refresh the
// route when rows change (H6) — so edits from other staff/devices appear
// without a manual reload. Best-effort: if the table isn't in the realtime
// publication the subscription simply never fires. Refreshes are debounced so
// a burst of changes triggers a single re-fetch.
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function useRealtimeRefresh(table: string, centerId: string | null | undefined) {
  const router = useRouter()
  useEffect(() => {
    if (!centerId) return
    const supabase = createClient()
    let t: ReturnType<typeof setTimeout> | null = null
    const ch = supabase
      .channel(`rt-${table}-${centerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `center_id=eq.${centerId}` },
        () => { if (t) clearTimeout(t); t = setTimeout(() => router.refresh(), 400) })
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch) }
  }, [table, centerId, router])
}
