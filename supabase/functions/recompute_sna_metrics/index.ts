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

type Body = { center_id?: string; rebuild?: boolean; project_shared?: boolean }
type Edge = { u: string; v: string; w: number; directed: boolean }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function weightToDistance(w: number): number {
  return 1 / Math.max(w, 1e-6)
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

function weightedBetweenness(n: number, adj: Array<Map<number, number>>): number[] {
  const Cb = new Array<number>(n).fill(0)
  for (let s = 0; s < n; s++) {
    const stack: number[] = []
    const pred: number[][] = Array.from({ length: n }, () => [])
    const sigma = new Array<number>(n).fill(0)
    const dist = new Array<number>(n).fill(Infinity)
    const done = new Array<boolean>(n).fill(false)
    sigma[s] = 1; dist[s] = 0
    for (;;) {
      let v = -1, best = Infinity
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; v = i }
      if (v === -1) break
      done[v] = true; stack.push(v)
      for (const [to, w] of adj[v]) {
        const nd = dist[v] + weightToDistance(w), eps = 1e-12
        if (nd < dist[to] - eps) { dist[to] = nd; sigma[to] = sigma[v]; pred[to] = [v] }
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

function weightedCloseness(n: number, adj: Array<Map<number, number>>): number[] {
  const Cc = new Array<number>(n).fill(0)
  for (let s = 0; s < n; s++) {
    const dist = new Array<number>(n).fill(Infinity)
    const done = new Array<boolean>(n).fill(false)
    dist[s] = 0
    for (;;) {
      let v = -1, best = Infinity
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; v = i }
      if (v === -1) break
      done[v] = true
      for (const [to, w] of adj[v]) {
        const nd = dist[v] + weightToDistance(w)
        if (nd < dist[to]) dist[to] = nd
      }
    }
    let sum = 0, reach = 0
    for (let i = 0; i < n; i++) if (i !== s && dist[i] < Infinity) { sum += dist[i]; reach++ }
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
      .select('source_kind, source_id, target_kind, target_id, weight, is_directed')
      .eq('center_id', center_id).is('deleted_at', null).gt('weight', 0)
    if (iErr) throw iErr

    const g = new Graph()
    for (const id of childIds) g.node(`child:${id}`)

    const childChild: Edge[] = []
    const childCaregiver: Array<{ child: string; care: string; w: number }> = []
    for (const r of ints ?? []) {
      const sKind = r.source_kind, tKind = r.target_kind
      const w = Number(r.weight), directed = !!r.is_directed
      if (sKind === 'child' && tKind === 'child' && childSet.has(r.source_id) && childSet.has(r.target_id)) {
        childChild.push({ u: r.source_id, v: r.target_id, w, directed })
      } else if (sKind === 'child' && (tKind === 'staff' || tKind === 'guardian')) {
        childCaregiver.push({ child: r.source_id, care: `${tKind}:${r.target_id}`, w })
      } else if (tKind === 'child' && (sKind === 'staff' || sKind === 'guardian')) {
        childCaregiver.push({ child: r.target_id, care: `${sKind}:${r.source_id}`, w })
      }
    }

    for (const e of childChild) {
      g.addUndirected(`child:${e.u}`, `child:${e.v}`, e.w)
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

    const betw = weightedBetweenness(n, g.adj)
    const close = weightedCloseness(n, g.adj)
    const eig = eigenvector(n, g.adj)
    const clu = clustering(n, g.adj)
    const comm = labelPropagation(n, g.adj)
    const now = new Date().toISOString()

    const rows: any[] = []
    for (let i = 0; i < n; i++) {
      const key = g.keys[i]
      if (!key.startsWith('child:')) continue
      const childId = key.slice('child:'.length)
      if (!childSet.has(childId)) continue
      const deg = g.adj[i].size
      let wdeg = 0
      for (const [, w] of g.adj[i]) wdeg += w
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
