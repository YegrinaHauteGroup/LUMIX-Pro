// ============================================================
// LUMIX Pro - recompute_sna_metrics (comprehensive SNA engine)
// ------------------------------------------------------------
// Computes a full set of weighted Social Network Analysis metrics
// for every active child of a center and persists them into
// public.sna_metrics (one snapshot per day).
//
// Metrics:
//   - degree / weighted_degree / in_degree / out_degree
//   - degree_centrality (normalised degree)
//   - betweenness        (weighted Brandes + Dijkstra)
//   - closeness          (weighted, Wasserman-Faust normalised)
//   - eigenvector        (power iteration on weighted adjacency)
//   - clustering_coeff   (local clustering)
//   - community_id       (weighted label propagation)
//   - is_isolated
//
// Ontology power: besides direct child<->child edges, the engine
// projects shared-caregiver structure (child<->staff, child<->guardian)
// into inferred child<->child "co-affiliation" links, surfacing
// connections that are invisible in raw peer data.
//
// Body: { center_id: string, rebuild?: boolean, project_shared?: boolean }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.47.1'
import { assertCenterMember } from '../_shared/auth.ts'

type Body = { center_id?: string; rebuild?: boolean; project_shared?: boolean }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Edge valence → relationship strength ──────────────────────────────────
// Maps interaction sentiment + domain onto a signed multiplier so that the
// *quality* of a relationship (not just its frequency) drives the geometry:
//   positive (cooperation / yielding / care)  →  strong, "close"
//   conflict / avoidance                       →  negative, "far" (≈∞)
function valence(relationType: string, label: string | null): number {
  const l = label ?? ''
  if (relationType === 'conflict' || /갈등|분쟁|기피|거부|편식|다툼/.test(l)) return -2
  if (relationType === 'caregiving' || /돌봄|보살핌/.test(l)) return 1.6
  if (relationType === 'help_seeking' || /협동|양보|도움|위로|배려|나눔/.test(l)) return 1.5
  if (/단짝|친밀|모방/.test(l)) return 1.3
  if (relationType === 'play' || /놀이/.test(l)) return 1
  if (relationType === 'communication' || relationType === 'proximity' || /선호|소통|근접/.test(l)) return 0.8
  return 1
}
const FAR = 1e4 // pseudo-∞ distance applied to conflict-dominant ties
// Convert a (dynamically normalised) signed net strength into a graph distance.
function netToDistance(net: number, maxAbs: number): number {
  const m = maxAbs > 0 ? maxAbs : 1
  if (net > 0) return m / net                 // strongest positive ≈ 1, weak ties far
  return FAR * (1 + Math.abs(net) / m)        // conflict ties pushed toward ∞
}

function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} is required`)
  return v
}

function serviceClient() {
  const url = mustEnv('SUPABASE_URL')
  // Edge functions auto-inject SUPABASE_SERVICE_ROLE_KEY; fall back to the
  // project's custom SUPABASE_SECRET_KEYS map for older deployments.
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) {
    const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
    if (raw) { try { key = JSON.parse(raw)['sb_secret_5x67m'] } catch { /* ignore */ } }
  }
  if (!key) throw new Error('Service role key not available (SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ---- Graph container -----------------------------------------------------
class Graph {
  idx = new Map<string, number>()
  keys: string[] = []
  adj: Array<Map<number, number>> = []
  outDeg: number[] = []
  inDeg: number[] = []

  node(key: string): number {
    const e = this.idx.get(key)
    if (e !== undefined) return e
    const i = this.keys.length
    this.idx.set(key, i)
    this.keys.push(key)
    this.adj.push(new Map())
    this.outDeg.push(0); this.inDeg.push(0)
    return i
  }

  addUndirected(a: string, b: string, w: number) {
    if (a === b) return
    const i = this.node(a), j = this.node(b)
    this.adj[i].set(j, (this.adj[i].get(j) ?? 0) + w)
    this.adj[j].set(i, (this.adj[j].get(i) ?? 0) + w)
  }

  recordDirected(a: string, b: string, directed: boolean) {
    const i = this.node(a), j = this.node(b)
    this.outDeg[i] += 1
    this.inDeg[j] += 1
    if (!directed) { this.outDeg[j] += 1; this.inDeg[i] += 1 }
  }
}

// Weighted Brandes betweenness over a DISTANCE adjacency (Dijkstra SSSP).
// Edge values are pre-computed geodesic distances (positive ties short,
// conflict ties ≈∞), so mediators bridging positive clusters score high while
// "social butterflies" with many shallow/negative ties do not.
// Binary min-heap keyed by distance — replaces the O(V) linear scan in the
// Dijkstra inner loops so betweenness/closeness run in O(V·E·logV) instead of
// O(V³) (H1). Stale entries are skipped via the caller's `done` array.
class MinHeap {
  private d: number[] = []
  private v: number[] = []
  get size() { return this.v.length }
  push(dist: number, node: number) {
    this.d.push(dist); this.v.push(node)
    let i = this.v.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (this.d[p] <= this.d[i]) break; this.swap(i, p); i = p }
  }
  pop(): number {
    const tv = this.v[0]
    const ld = this.d.pop()!, lv = this.v.pop()!
    if (this.v.length) { this.d[0] = ld; this.v[0] = lv; this.down(0) }
    return tv
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

function weightedBetweenness(n: number, adjDist: Array<Map<number, number>>): number[] {
  const Cb = new Array<number>(n).fill(0)
  for (let s = 0; s < n; s++) {
    const stack: number[] = []
    const pred: number[][] = Array.from({ length: n }, () => [])
    const sigma = new Array<number>(n).fill(0)
    const dist = new Array<number>(n).fill(Infinity)
    const done = new Array<boolean>(n).fill(false)
    sigma[s] = 1; dist[s] = 0
    const heap = new MinHeap(); heap.push(0, s)
    while (heap.size) {
      const v = heap.pop()
      if (done[v]) continue
      done[v] = true; stack.push(v)
      for (const [to, d] of adjDist[v]) {
        const nd = dist[v] + d, eps = 1e-9
        if (nd < dist[to] - eps) { dist[to] = nd; sigma[to] = sigma[v]; pred[to] = [v]; heap.push(nd, to) }
        else if (Math.abs(nd - dist[to]) <= eps) { sigma[to] += sigma[v]; pred[to].push(v) }
      }
    }
    const delta = new Array<number>(n).fill(0)
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred[w]) if (sigma[w] !== 0) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      if (w !== s) Cb[w] += delta[w]
    }
  }
  for (let i = 0; i < n; i++) Cb[i] /= 2
  return Cb
}

function weightedCloseness(n: number, adjDist: Array<Map<number, number>>): number[] {
  const Cc = new Array<number>(n).fill(0)
  for (let s = 0; s < n; s++) {
    const dist = new Array<number>(n).fill(Infinity)
    const done = new Array<boolean>(n).fill(false)
    dist[s] = 0
    const heap = new MinHeap(); heap.push(0, s)
    while (heap.size) {
      const v = heap.pop()
      if (done[v]) continue
      done[v] = true
      for (const [to, d] of adjDist[v]) {
        const nd = dist[v] + d
        if (nd < dist[to]) { dist[to] = nd; heap.push(nd, to) }
      }
    }
    let sum = 0, reach = 0
    for (let i = 0; i < n; i++) if (i !== s && dist[i] < FAR) { sum += dist[i]; reach++ }
    if (reach > 0 && sum > 0 && n > 1) Cc[s] = (reach / (n - 1)) * (reach / sum)
  }
  return Cc
}

function eigenvector(n: number, adj: Array<Map<number, number>>): number[] {
  if (n === 0) return []
  let x = new Array<number>(n).fill(1 / Math.sqrt(n))
  for (let it = 0; it < 200; it++) {
    const nx = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) for (const [j, w] of adj[i]) nx[i] += w * x[j]
    const norm = Math.sqrt(nx.reduce((a, b) => a + b * b, 0))
    if (norm < 1e-12) return new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) nx[i] /= norm
    let diff = 0
    for (let i = 0; i < n; i++) diff += Math.abs(nx[i] - x[i])
    x = nx
    if (diff < 1e-9) break
  }
  return x
}

function clustering(n: number, adj: Array<Map<number, number>>): number[] {
  const cc = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    const nbrs = [...adj[i].keys()]
    const k = nbrs.length
    if (k < 2) continue
    let links = 0
    for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (adj[nbrs[a]].has(nbrs[b])) links++
    cc[i] = (2 * links) / (k * (k - 1))
  }
  return cc
}

function labelPropagation(n: number, adj: Array<Map<number, number>>): number[] {
  const label = Array.from({ length: n }, (_, i) => i)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let it = 0; it < 100; it++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = order[i]; order[i] = order[j]; order[j] = t
    }
    let changed = false
    for (const v of order) {
      if (adj[v].size === 0) continue
      const score = new Map<number, number>()
      for (const [u, w] of adj[v]) score.set(label[u], (score.get(label[u]) ?? 0) + w)
      let bestLabel = label[v], bestW = -Infinity
      for (const [lab, w] of score) if (w > bestW || (w === bestW && lab < bestLabel)) { bestW = w; bestLabel = lab }
      if (bestLabel !== label[v]) { label[v] = bestLabel; changed = true }
    }
    if (!changed) break
  }
  const remap = new Map<number, number>()
  let next = 0
  return label.map((l) => {
    if (!remap.has(l)) remap.set(l, next++)
    return remap.get(l)!
  })
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
  const projectShared = body.project_shared !== false

  try {
    const sb = serviceClient()
    if (!(await assertCenterMember(req, sb, center_id))) return json({ ok: false, error: 'forbidden' }, 403)

    if (body.rebuild) {
      const { error } = await sb.rpc('rebuild_sna_edges', { p_center_id: center_id })
      if (error) throw error
    }

    const { data: children, error: cErr } = await sb
      .from('children').select('id')
      .eq('center_id', center_id).eq('status', 'active').is('deleted_at', null)
    if (cErr) throw cErr
    const childIds: string[] = (children ?? []).map((c: any) => c.id)
    const childSet = new Set(childIds)
    const period = new Date().toISOString().slice(0, 10)

    if (childIds.length === 0) return json({ ok: true, computed: 0, nodes: 0 })

    const { data: ints, error: iErr } = await sb
      .from('interactions')
      .select('source_kind, source_id, target_kind, target_id, weight, is_directed, relation_type, label')
      .eq('center_id', center_id).is('deleted_at', null).gt('weight', 0)
    if (iErr) throw iErr

    const g = new Graph()
    for (const id of childIds) g.node(`child:${id}`)

    const childChild: Array<{ u: string; v: string; sw: number; directed: boolean }> = []
    const childCaregiver: Array<{ child: string; care: string; w: number }> = []
    for (const r of ints ?? []) {
      const sKind = r.source_kind, tKind = r.target_kind
      const w = Number(r.weight), directed = !!r.is_directed
      if (sKind === 'child' && tKind === 'child' && childSet.has(r.source_id) && childSet.has(r.target_id)) {
        // signed strength = frequency × relationship valence (quality/context)
        childChild.push({ u: r.source_id, v: r.target_id, sw: w * valence(r.relation_type, r.label), directed })
      } else if (sKind === 'child' && (tKind === 'staff' || tKind === 'guardian')) {
        childCaregiver.push({ child: r.source_id, care: `${tKind}:${r.target_id}`, w })
      } else if (tKind === 'child' && (sKind === 'staff' || sKind === 'guardian')) {
        childCaregiver.push({ child: r.target_id, care: `${sKind}:${r.source_id}`, w })
      }
    }

    // Accumulate net signed strength per pair (conflict + cooperation can cancel).
    for (const e of childChild) {
      g.addUndirected(`child:${e.u}`, `child:${e.v}`, e.sw)
      g.recordDirected(`child:${e.u}`, `child:${e.v}`, e.directed)
    }

    let inferred = 0
    if (projectShared && childCaregiver.length > 0) {
      const byCare = new Map<string, Array<{ child: string; w: number }>>()
      for (const cc of childCaregiver) {
        if (!byCare.has(cc.care)) byCare.set(cc.care, [])
        byCare.get(cc.care)!.push({ child: cc.child, w: cc.w })
      }
      const DAMP = 0.35
      for (const [, members] of byCare) {
        for (let a = 0; a < members.length; a++) {
          for (let b = a + 1; b < members.length; b++) {
            if (members[a].child === members[b].child) continue
            g.addUndirected(`child:${members[a].child}`, `child:${members[b].child}`, DAMP * Math.min(members[a].w, members[b].w))
            inferred++
          }
        }
      }
    }

    const n = g.keys.length
    if (n > 1500) return json({ ok: false, error: `Graph too large: ${n}` }, 400)

    // Dynamic normalisation: scale all net strengths by the strongest tie, then
    // derive a DISTANCE adjacency (for geodesic metrics) and a POSITIVE-only
    // INFLUENCE adjacency (for eigenvector / community / degree).
    let maxAbs = 0
    for (let i = 0; i < n; i++) for (const [, net] of g.adj[i]) { const a = Math.abs(net); if (a > maxAbs) maxAbs = a }
    const adjDist: Array<Map<number, number>> = Array.from({ length: n }, () => new Map())
    const adjPos: Array<Map<number, number>> = Array.from({ length: n }, () => new Map())
    for (let i = 0; i < n; i++) {
      for (const [j, net] of g.adj[i]) {
        adjDist[i].set(j, netToDistance(net, maxAbs))
        if (net > 0) adjPos[i].set(j, net)
      }
    }

    const betw = weightedBetweenness(n, adjDist)
    const close = weightedCloseness(n, adjDist)
    const eig = eigenvector(n, adjPos)
    const clu = clustering(n, adjPos)
    const comm = labelPropagation(n, adjPos)
    const now = new Date().toISOString()

    const rows: any[] = []
    for (let i = 0; i < n; i++) {
      const key = g.keys[i]
      if (!key.startsWith('child:')) continue
      const childId = key.slice('child:'.length)
      if (!childSet.has(childId)) continue
      // degree / isolation are based on POSITIVE social ties: a child whose only
      // links are conflicts is socially isolated (and a supervision risk).
      const deg = adjPos[i].size
      let wdeg = 0
      for (const [, w] of adjPos[i]) wdeg += w
      rows.push({
        center_id, child_id: childId, period_start: period, period_end: period,
        degree: deg, weighted_degree: wdeg, degree_centrality: n > 1 ? deg / (n - 1) : 0,
        in_degree: g.inDeg[i], out_degree: g.outDeg[i],
        betweenness: Number.isFinite(betw[i]) ? betw[i] : 0,
        closeness: Number.isFinite(close[i]) ? close[i] : 0,
        eigenvector: Number.isFinite(eig[i]) ? eig[i] : 0,
        clustering_coeff: Number.isFinite(clu[i]) ? clu[i] : 0,
        community_id: comm[i], is_isolated: deg === 0,
        computed_at: now, updated_at: now,
      })
    }

    const { error: upErr } = await sb
      .from('sna_metrics')
      .upsert(rows, { onConflict: 'center_id,child_id,period_start,period_end' })
    if (upErr) throw upErr

    return json({ ok: true, computed: rows.length, nodes: n, child_child_edges: childChild.length, inferred_edges: inferred })
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500)
  }
})
