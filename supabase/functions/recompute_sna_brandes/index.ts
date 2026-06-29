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
import { assertCenterMember } from '../_shared/auth.ts'
import { CORS, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/client.ts'
import { weightToDistance } from '../_shared/sna.ts'

type Body = { center_id?: string }

// Binary min-heap keyed by distance — replaces the O(V) linear scan in
// Dijkstra so Brandes runs in O(V·E·logV) instead of O(V³) (H1). Stale entries
// (a node re-pushed at a shorter distance) are skipped via the caller's `done`.
class MinHeap {
  private d: number[] = []
  private v: number[] = []
  get size() { return this.v.length }
  push(dist: number, node: number) {
    this.d.push(dist); this.v.push(node)
    let i = this.v.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (this.d[p] <= this.d[i]) break; this.swap(i, p); i = p }
  }
  pop(): [number, number] {
    const td = this.d[0], tv = this.v[0]
    const ld = this.d.pop()!, lv = this.v.pop()!
    if (this.v.length) { this.d[0] = ld; this.v[0] = lv; this.down(0) }
    return [td, tv]
  }
  private down(i: number) {
    const n = this.v.length
    for (;;) {
      let s = i; const l = 2 * i + 1, r = 2 * i + 2
      if (l < n && this.d[l] < this.d[s]) s = l
      if (r < n && this.d[r] < this.d[s]) s = r
      if (s === i) break
      this.swap(i, s); i = s
    }
  }
  private swap(i: number, j: number) {
    const td = this.d[i]; this.d[i] = this.d[j]; this.d[j] = td
    const tv = this.v[i]; this.v[i] = this.v[j]; this.v[j] = tv
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })
  let body: Body = {}
  try { const raw = await req.text(); body = raw ? JSON.parse(raw) : {} } catch { /* empty */ }
  if (!body.center_id) return json({ ok: false, error: 'center_id is required' }, 400)
  const center_id = body.center_id

  try {
    const { sb } = serviceClient()
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
      const heap = new MinHeap(); heap.push(0, s)
      while (heap.size) {
        const [, x] = heap.pop()
        if (done[x]) continue // stale (already finalized at a shorter distance)
        done[x] = true; stack.push(x)
        for (const e of adj[x]) {
          const nd = dist[x] + e.w, eps = 1e-12
          if (nd < dist[e.v] - eps) { dist[e.v] = nd; sigma[e.v] = sigma[x]; pred[e.v] = [x]; heap.push(nd, e.v) }
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
