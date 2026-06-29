// ============================================================
// LUMIX Pro - rebuild_sna_from_assessments
// ------------------------------------------------------------
// Regenerates ontology-driven interaction edges from the
// assessment tables (peer / staff / guardian) via the SQL
// function public.rebuild_sna_edges(center_id), then recomputes
// the full SNA metric suite. Safe to wire to a Supabase DB
// Webhook on the assessment tables.
//
// Body: { center_id?, record?, old_record?, skip_metrics? }
// ============================================================
import { assertCenterMember } from '../_shared/auth.ts'
import { CORS, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/client.ts'

type Rec = { id?: string; center_id?: string; child_id?: string; from_child_id?: string }
type Body = { center_id?: string; record?: Rec | null; old_record?: Rec | null; skip_metrics?: boolean }

async function resolveCenterId(sb: any, body: Body): Promise<string> {
  if (body.center_id) return body.center_id
  if (body.record?.center_id) return body.record.center_id
  if (body.old_record?.center_id) return body.old_record.center_id
  const childId = body.record?.child_id ?? body.record?.from_child_id
    ?? body.old_record?.child_id ?? body.old_record?.from_child_id
  if (childId) {
    const { data } = await sb.from('children').select('center_id').eq('id', childId).maybeSingle()
    if (data?.center_id) return data.center_id
  }
  throw new Error('Could not determine center_id. Include center_id (or record.center_id) in the payload.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  const body = (await req.json().catch(() => ({}))) as Body
  try {
    const { sb, url, key } = serviceClient()
    const center_id = await resolveCenterId(sb, body)
    // C2: trusted DB-webhook/service-role calls pass; client calls must be members
    if (!(await assertCenterMember(req, sb, center_id))) return json({ ok: false, error: 'forbidden' }, 403)

    const { data: edges, error } = await sb.rpc('rebuild_sna_edges', { p_center_id: center_id })
    if (error) throw error

    let metrics: unknown = { skipped: true }
    if (!body.skip_metrics) {
      const resp = await fetch(`${url}/functions/v1/recompute_sna_metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ center_id, rebuild: false }),
      })
      metrics = await resp.json().catch(() => ({ ok: resp.ok }))
    }

    return json({ ok: true, center_id, edges, metrics })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
