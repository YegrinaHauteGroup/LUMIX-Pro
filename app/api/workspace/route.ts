import { createClient } from '@/utils/supabase/server'
import { getCenterId } from '@/lib/center'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET — list integrated workspace memos for the active center ("불러오기")
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  if (!centerId) return NextResponse.json({ memos: [] })
  const { data, error } = await supabase
    .from('workspace_memos')
    .select('id, title, body, mentions, source, created_at')
    .eq('center_id', centerId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ memos: [], error: error.message }, { status: 500 })
  return NextResponse.json({ memos: data ?? [] })
}

// POST — integrate memo(s) into facility data ("데이터 통합")
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const centerId = await getCenterId()
  if (!centerId) return NextResponse.json({ ok: false, error: 'no center' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { memos?: { title?: string; body?: string; mentions?: string[]; source?: string }[] }
  const memos = (body.memos ?? []).filter((m) => (m.body ?? '').trim() !== '' || (m.title ?? '').trim() !== '')
  if (memos.length === 0) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()
  let authorStaffId: string | null = null
  if (user) {
    const { data: staff } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).is('deleted_at', null).limit(1).maybeSingle()
    authorStaffId = staff?.id ?? null
  }

  const rows = memos.map((m) => ({
    center_id: centerId, author_staff_id: authorStaffId,
    title: (m.title ?? '').slice(0, 200) || null, body: (m.body ?? '').slice(0, 8000),
    mentions: m.mentions ?? [], source: m.source ?? 'workspace',
  }))
  const { error } = await supabase.from('workspace_memos').insert(rows)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
