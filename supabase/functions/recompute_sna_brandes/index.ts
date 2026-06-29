// ============================================================
// LUMIX Pro - recompute_sna_brandes
// ------------------------------------------------------------
// Lightweight endpoint: weighted betweenness centrality
// (Brandes' algorithm + Dijkstra SSSP) over the full interaction
// graph, persisted per child. For the full metric suite use
// recompute_sna_metrics.
//
// Body: { center_id: string }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.47.1'
import { assertCenterMember } from '../_shared/auth.ts'

type Body = { center_id?: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function weightToDistance(w: number): number { return 1 / Math.max(w, 1e-6) }

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) {
    const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
    if (raw) { try { key = JSON.parse(raw)['sb_secret_5x67m'] } catch { /* ignore */ } }
  }
  if (!url || !key) throw new Error('SUPABASE_URL / service role key required')
  return createClient(url, key, { auth: { persistSession: false } })
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })
  let body: Body = {}
  try { const raw = await req.text(); body = raw ? JSON.parse(raw) : {} } catch { /* empty */ }
  if (!body.center_id) return json({ ok: false, error: 'center_id is required' }, 400)
  const center_id = body.center_id

  try {
    const sb = serviceClient()
    if (!(await assertCenterMember(req, sb, center_id))) return json({ ok: false, error: 'forbidden' }, 403)
    const { data: children } = await sb.from('children').select('id')
      .eq('center_id', center_id).eq('status', 'active').is('deleted_at', null)
    const childSet = new Set((children ?? []).map((c: any) => c.id))
    const period = new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()

    const { data: ints, error } = await sb.from('interactions')
      .select('source_kind, source_id, target_kind, target_id, weight, is_directed')
      .eq('center_id', center_id).is('deleted_at', null).gt('weight', 0)
    if (error) throw error

    // build indexed graph over all kinds (staff/guardian act as bridges)
    const idx = new Map<string, number>()
    const keys: string[] = []
    const kind: string[] = []
    const node = (k: string, knd: string) => {
      const e = idx.get(k); if (e !== undefined) return e
      const i = keys.length; idx.set(k, i); keys.push(k); kind.push(knd); return i
    }
    const adj: Array<Array<{ v: number; w: number }>> = []
    const ensure = (i: number) => { while (adj.length <= i) adj.push([]) }
    for (const r of ints ?? []) {
      const u = node(`${r.source_kind}:${r.source_id}`, r.source_kind)
      const v = node(`${r.target_kind}:${r.target_id}`, r.target_kind)
      ensure(u); ensure(v)
      const w = weightToDistance(Number(r.weight))
      adj[u].push({ v, w })
      if (!r.is_directed) adj[v].push({ v: u, w })
    }
    const n = keys.length
    ensure(n - 1)

    const betw = new Array<number>(n).fill(0)
    for (let s = 0; s < n; s++) {
      const stack: number[] = []
      const pred: number[][] = Array.from({ length: n }, () => [])
      const sigma = new Array<number>(n).fill(0)
      const dist = new Array<number>(n).fill(Infinity)
      const done = new Array<boolean>(n).fill(false)
      sigma[s] = 1; dist[s] = 0
      for (;;) {
        let x = -1, best = Infinity
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; x = i }
        if (x === -1) break
        done[x] = true; stack.push(x)
        for (const e of adj[x]) {
          const nd = dist[x] + e.w, eps = 1e-12
          if (nd < dist[e.v] - eps) { dist[e.v] = nd; sigma[e.v] = sigma[x]; pred[e.v] = [x] }
          else if (Math.abs(nd - dist[e.v]) <= eps) { sigma[e.v] += sigma[x]; pred[e.v].push(x) }
        }
      }
      const delta = new Array<number>(n).fill(0)
      while (stack.length) {
        const w = stack.pop()!
        for (const v of pred[w]) if (sigma[w] !== 0) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
        if (w !== s) betw[w] += delta[w]
      }
    }

    const rows: any[] = []
    for (let i = 0; i < n; i++) {
      if (kind[i] !== 'child') continue
      const childId = keys[i].slice(keys[i].indexOf(':') + 1)
      if (!childSet.has(childId)) continue
      rows.push({
        center_id, child_id: childId, period_start: period, period_end: period,
        betweenness: betw[i] / 2, computed_at: now, updated_at: now,
      })
    }
    // include isolated children with 0
    for (const id of childSet) {
      if (!rows.find((r) => r.child_id === id)) {
        rows.push({ center_id, child_id: id, period_start: period, period_end: period, betweenness: 0, computed_at: now, updated_at: now })
      }
    }

    const { error: upErr } = await sb.from('sna_metrics')
      .upsert(rows, { onConflict: 'center_id,child_id,period_start,period_end' })
    if (upErr) throw upErr

    return json({ ok: true, updated: rows.length, nodes: n, edges: (ints ?? []).length })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
