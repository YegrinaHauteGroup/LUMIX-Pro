import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET — list snapshots (metadata), or ?id= to fetch one snapshot's full items
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  if (!centerId) return NextResponse.json({ snapshots: [] })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const { data, error } = await supabase.from('workspace_snapshots').select('id, title, items, created_at').eq('center_id', centerId).eq('id', id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ snapshot: data })
  }
  const { data, error } = await supabase.from('workspace_snapshots')
    .select('id, title, item_count, created_at').eq('center_id', centerId)
    .order('created_at', { ascending: false }).limit(60)
  if (error) return NextResponse.json({ snapshots: [], error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data ?? [] })
}

// POST — save a snapshot of all current workspace items
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  if (!centerId) return NextResponse.json({ ok: false, error: 'no center' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { title?: string; items?: unknown[] }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  let authorStaffId: string | null = null
  if (user) {
    const { data: staff } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).is('deleted_at', null).limit(1).maybeSingle()
    authorStaffId = staff?.id ?? null
  }

  const { data, error } = await supabase.from('workspace_snapshots')
    .insert({ center_id: centerId, author_staff_id: authorStaffId, title: (body.title ?? '').slice(0, 200) || null, items, item_count: items.length })
    .select('id, title, item_count, created_at').single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, snapshot: data })
}

// DELETE — ?id= remove a snapshot
export async function DELETE(req: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  const id = new URL(req.url).searchParams.get('id')
  if (!centerId || !id) return NextResponse.json({ ok: false }, { status: 400 })
  const { error } = await supabase.from('workspace_snapshots').delete().eq('center_id', centerId).eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
