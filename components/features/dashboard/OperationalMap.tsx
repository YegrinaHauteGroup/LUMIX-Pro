'use client'

import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Layers, Locate, MapPin, Navigation, RefreshCw, Satellite, ShieldAlert } from 'lucide-react'

interface Props {
  lat: number | null
  lng: number | null
  label?: string | null
  airPm25?: number | null
  airGrade?: string | null
}

// POI categories pulled from OpenStreetMap (Overpass) — surrounding response
// assets, transit & amenities around the facility.
const CATS: Record<string, { label: string; color: string; q: string[] }> = {
  medical: { label: '의료', color: '#e5484d', q: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'] },
  pharmacy: { label: '약국', color: '#ec4899', q: ['amenity=pharmacy'] },
  police: { label: '경찰', color: '#2563eb', q: ['amenity=police'] },
  fire: { label: '소방', color: '#f97316', q: ['amenity=fire_station'] },
  childcare: { label: '보육', color: '#8b5cf6', q: ['amenity=kindergarten', 'amenity=childcare'] },
  school: { label: '학교', color: '#16a34a', q: ['amenity=school'] },
  subway: { label: '역', color: '#0891b2', q: ['railway=station'] },
  mart: { label: '마트', color: '#eab308', q: ['shop=supermarket', 'shop=convenience'] },
  park: { label: '공원', color: '#22c55e', q: ['leisure=park'] },
  gov: { label: '관공서', color: '#64748b', q: ['amenity=townhall', 'office=government'] },
}
type CatKey = keyof typeof CATS
interface Poi { id: number; lat: number; lon: number; name: string; cat: CatKey }

// great-circle distance (m) + initial bearing (°) facility → asset
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180, toDeg = (r: number) => (r * 180) / Math.PI
  const dLng = toRad(bLng - aLng)
  const y = Math.sin(dLng) * Math.cos(toRad(bLat))
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}
const COMPASS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
const dirOf = (deg: number) => COMPASS[Math.round(deg / 45) % 8]
const fmtD = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`)
const walkMin = (m: number) => Math.max(1, Math.round(m / 75)) // ≈75 m/min

// Korea-only viewport so the map never drifts into foreign territory.
const KR_BOUNDS: [[number, number], [number, number]] = [[32.8, 124.4], [39.2, 132.2]]

export function OperationalMap({ lat, lng, label, airPm25, airGrade }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  // deno-lint-ignore no-explicit-any
  const mapRef = useRef<any>(null)
  const layerRef = useRef<{ base?: any; sat?: any; markers?: any; rings?: any; line?: any; L?: any }>({})
  const [view, setView] = useState<'light' | 'sat'>('light')
  const [pois, setPois] = useState<Poi[]>([])
  const [active, setActive] = useState<Record<CatKey, boolean>>({
    medical: true, pharmacy: true, police: true, fire: true, childcare: true,
    subway: true, mart: true, gov: true, school: false, park: false,
  })
  const [loadingPois, setLoadingPois] = useState(false)
  const [poiErr, setPoiErr] = useState(false)
  const [selected, setSelected] = useState<Poi | null>(null)
  const [briefTime, setBriefTime] = useState<Date | null>(null)
  const hasLoc = lat != null && lng != null

  const risk = useMemo(() => {
    const p = airPm25 ?? null
    if (p == null) return null
    const level = p > 75 ? 'high' : p > 35 ? 'mid' : 'low'
    return {
      level,
      color: level === 'high' ? '#e5484d' : level === 'mid' ? '#d97706' : '#16a34a',
      text: `PM2.5 ${Math.round(p)}㎍/㎥ · ${airGrade ?? '-'}`,
      msg: level === 'high' ? '대기질 매우 나쁨 — 실외활동 자제 권고' : level === 'mid' ? '대기질 나쁨 — 민감군 실외활동 주의' : '대기질 양호 — 실외활동 적합',
    }
  }, [airPm25, airGrade])

  // nearest asset per category (name + distance + bearing)
  const nearest = useMemo(() => {
    const find = (cat: CatKey) => {
      if (!hasLoc) return null
      let best: { name: string; d: number; dir: string } | null = null
      for (const p of pois) {
        if (p.cat !== cat) continue
        const d = haversine(lat!, lng!, p.lat, p.lon)
        if (!best || d < best.d) best = { name: p.name, d, dir: dirOf(bearing(lat!, lng!, p.lat, p.lon)) }
      }
      return best
    }
    return { medical: find('medical'), police: find('police'), fire: find('fire'), pharmacy: find('pharmacy') } as Record<CatKey, { name: string; d: number; dir: string } | null>
  }, [pois, hasLoc, lat, lng])

  const detail = useMemo(() => {
    if (!selected || !hasLoc) return null
    const d = haversine(lat!, lng!, selected.lat, selected.lon)
    return { name: selected.name, cat: selected.cat, d, dir: dirOf(bearing(lat!, lng!, selected.lat, selected.lon)), walk: walkMin(d) }
  }, [selected, hasLoc, lat, lng])

  // live situational briefing (derived alerts)
  const brief = useMemo(() => {
    const items: { tone: 'red' | 'amber' | 'green' | 'blue'; text: string }[] = []
    if (risk) items.push({ tone: risk.level === 'high' ? 'red' : risk.level === 'mid' ? 'amber' : 'green', text: risk.msg })
    const m = nearest.medical
    if (m) items.push({ tone: m.d <= 800 ? 'green' : m.d <= 1500 ? 'amber' : 'red', text: `응급의료 ${m.name} · ${fmtD(m.d)} ${m.dir}쪽 · 도보 ~${walkMin(m.d)}분` })
    const pol = nearest.police
    if (pol) items.push({ tone: 'blue', text: `치안 거점 ${pol.name} · ${fmtD(pol.d)} ${pol.dir}쪽` })
    const total = pois.filter((p) => active[p.cat]).length
    items.push({ tone: 'blue', text: `반경 1.5km 대응자산 ${total}곳 실시간 탐지` })
    return items
  }, [risk, nearest, pois, active])

  // init map once we have coordinates
  useEffect(() => {
    if (!hasLoc || !elRef.current || mapRef.current) return
    let disposed = false
    ;(async () => {
      const L = (await import('leaflet')).default as any
      if (disposed || !elRef.current) return
      const map = L.map(elRef.current, {
        center: [lat, lng], zoom: 16, zoomControl: false, attributionControl: true,
        minZoom: 7, maxBounds: KR_BOUNDS, maxBoundsViscosity: 0.7,
      })
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      // 2D white / clean (CartoDB Positron — good Korean labels, no key)
      const base = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map)
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Tiles &copy; Esri',
      })
      const rings = L.layerGroup([
        L.circle([lat, lng], { radius: 300, color: '#137cbd', weight: 1, opacity: 0.55, fill: false, dashArray: '4 5' }),
        L.circle([lat, lng], { radius: 700, color: '#137cbd', weight: 1, opacity: 0.34, fill: false, dashArray: '4 5' }),
        L.circle([lat, lng], { radius: 1500, color: '#137cbd', weight: 1, opacity: 0.2, fill: false, dashArray: '4 5' }),
      ]).addTo(map)
      const pin = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html:
        `<div style="position:relative"><span style="position:absolute;inset:-7px;border-radius:999px;background:#137cbd33;animation:lmpulse 2s ease-out infinite"></span><span style="position:absolute;inset:0;border-radius:999px;background:#137cbd;border:2px solid #fff;box-shadow:0 0 0 2px #137cbd,0 1px 4px rgba(0,0,0,.4)"></span></div>` })
      L.marker([lat, lng], { icon: pin, zIndexOffset: 1000 }).addTo(map).bindTooltip(label ?? '우리 시설', { direction: 'top', offset: [0, -10] })
      const markers = L.layerGroup().addTo(map)
      map.on('click', () => setSelected(null))
      layerRef.current = { base, sat, markers, rings, L }
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 60)
    })()
    return () => { disposed = true; mapRef.current?.remove?.(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoc])

  // base layer toggle
  useEffect(() => {
    const { base, sat } = layerRef.current
    const map = mapRef.current
    if (!map || !base || !sat) return
    if (view === 'sat') { map.removeLayer(base); sat.addTo(map) } else { map.removeLayer(sat); base.addTo(map) }
  }, [view])

  // fetch nearby POIs (Overpass / OpenStreetMap) — race mirrors for speed
  async function loadPois() {
    if (!hasLoc) return
    setLoadingPois(true); setPoiErr(false)
    // `nwr` = node + way + relation. Most Korean facilities are mapped as
    // ways/relations, so a node-only query returns almost nothing; `out center`
    // collapses each area to a representative point.
    const filters = Object.values(CATS).flatMap((c) => c.q.map((q) => `nwr[${q.replace('=', '="')}"](around:1500,${lat},${lng});`)).join('')
    const query = `[out:json][timeout:15];(${filters});out center 250;`
    const body = 'data=' + encodeURIComponent(query)
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ]
    const catOf = (tags: Record<string, string>): CatKey | null => {
      for (const k of Object.keys(CATS) as CatKey[]) {
        for (const q of CATS[k].q) { const [tk, tv] = q.split('='); if (tags[tk] === tv) return k }
      }
      return null
    }
    const ctrl = new AbortController()
    try {
      // first mirror to respond wins; the rest are aborted
      const data: any = await Promise.any(endpoints.map(async (url) => {
        const r = await fetch(url, { method: 'POST', body, signal: ctrl.signal })
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      }))
      ctrl.abort()
      const out: Poi[] = []
      const seen = new Set<number>()
      for (const el of data.elements ?? []) {
        const cat = catOf(el.tags ?? {})
        const plat = el.lat ?? el.center?.lat
        const plon = el.lon ?? el.center?.lon
        if (!cat || plat == null || plon == null || seen.has(el.id)) continue
        seen.add(el.id)
        out.push({ id: el.id, lat: plat, lon: plon, name: el.tags?.name ?? CATS[cat].label, cat })
      }
      setPois(out)
    } catch { setPoiErr(true) } finally { setLoadingPois(false); setBriefTime(new Date()) }
  }
  useEffect(() => { if (hasLoc) loadPois() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hasLoc])

  // render filtered markers (circular Gotham-style nodes)
  useEffect(() => {
    const { markers, L } = layerRef.current
    if (!markers || !L || !hasLoc) return
    markers.clearLayers()
    for (const p of pois) {
      if (!active[p.cat]) continue
      const c = CATS[p.cat].color
      const icon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html:
        `<span class="lm-poi" style="background:${c}26;border-color:${c};box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 0 8px ${c}99"><i style="background:${c}"></i></span>` })
      const d = haversine(lat!, lng!, p.lat, p.lon)
      const dir = dirOf(bearing(lat!, lng!, p.lat, p.lon))
      L.marker([p.lat, p.lon], { icon }).addTo(markers)
        .bindTooltip(`<b style="color:${c}">${CATS[p.cat].label}</b> · ${p.name}`, { direction: 'top' })
        .bindPopup(`<div style="min-width:130px"><b style="color:${c}">${CATS[p.cat].label}</b> · ${p.name}<br><span style="color:#8b949e">직선 ${fmtD(d)} · ${dir}쪽 · 도보 ~${walkMin(d)}분</span></div>`)
        .on('click', () => setSelected(p))
    }
  }, [pois, active, hasLoc, lat, lng])

  // draw direction line facility → selected asset
  useEffect(() => {
    const { L } = layerRef.current
    const map = mapRef.current
    if (!map || !L || !hasLoc) return
    if (layerRef.current.line) { map.removeLayer(layerRef.current.line); layerRef.current.line = undefined }
    if (selected) {
      layerRef.current.line = L.polyline([[lat, lng], [selected.lat, selected.lon]], {
        color: '#137cbd', weight: 2, opacity: 0.85, dashArray: '6 6',
      }).addTo(map)
    }
  }, [selected, hasLoc, lat, lng])

  function recenter() { const m = mapRef.current; if (m && hasLoc) m.setView([lat, lng], 16, { animate: true }) }

  if (!hasLoc) {
    return (
      <div className="h-full w-full rounded-[3px] border border-line bg-fill-2 flex flex-col items-center justify-center text-center p-6">
        <MapPin size={28} className="text-ink-ghost mb-2" />
        <p className="text-[13px] text-ink font-medium">시설 위치가 설정되지 않았습니다</p>
        <p className="text-[11px] text-ink-faint mt-1 mb-3">작전 지도와 주변 대응 자산을 보려면 시설 좌표를 저장하세요.</p>
        <Link href="/settings" className="text-[12px] text-accent hover:text-accent-hover font-medium">설정에서 시설 좌표 저장하기 →</Link>
      </div>
    )
  }

  const toneColor = { red: '#e5484d', amber: '#d97706', green: '#16a34a', blue: '#137cbd' } as const

  return (
    <div className="relative isolate h-full w-full rounded-[3px] border border-line overflow-hidden bg-[#e9edf2]">
      <style>{`@keyframes lmpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}
        @keyframes lmlive{0%,100%{opacity:1}50%{opacity:.25}}
        .leaflet-container{background:#e9edf2;font-family:inherit}
        .lm-poi{display:block;width:14px;height:14px;border-radius:50%;border:1.7px solid;position:relative;transition:transform .12s ease;cursor:pointer}
        .lm-poi>i{position:absolute;inset:3.5px;border-radius:50%;display:block}
        .leaflet-marker-icon:hover .lm-poi{transform:scale(1.32)}
        .leaflet-tooltip{background:#0f1620;border:1px solid #30363d;color:#e6edf3;font-size:11px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
        .leaflet-tooltip-top:before{border-top-color:#30363d}
        .leaflet-popup-content-wrapper{background:#0f1620;color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px}
        .leaflet-popup-tip{background:#0f1620;border:1px solid #30363d}
        .leaflet-popup-content{margin:8px 10px}
        .leaflet-control-zoom a{background:#0f1620;color:#c9d1d9;border-color:#30363d}
        .leaflet-control-attribution{background:rgba(255,255,255,.7);color:#5c7080;font-size:9px}
        .leaflet-control-attribution a{color:#137cbd}`}</style>
      <div ref={elRef} className="absolute inset-0" />

      {/* Title + live briefing (left stack) */}
      <div className="absolute top-2.5 left-2.5 z-[500] flex flex-col gap-1.5 w-[224px]">
        <div className="bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Crosshair size={12} className="text-[#58a6ff]" />
              <span className="text-[11px] font-semibold text-[#c9d1d9] tracking-wide uppercase">작전 지도 · Vertex</span>
            </div>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" style={{ animation: 'lmlive 1.6s ease-in-out infinite' }} />
              <span className="text-[8.5px] font-semibold text-[#16a34a] tracking-widest">LIVE</span>
            </span>
          </div>
          <p className="text-[10px] text-[#8b949e] font-mono mt-0.5 truncate">{label ?? '우리 시설'} · {lat!.toFixed(5)}, {lng!.toFixed(5)}</p>
        </div>

        <div className="bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-[#30363d] flex items-center justify-between">
            <span className="text-[9.5px] font-semibold text-[#8b949e] uppercase tracking-wider">실시간 상황 브리핑</span>
            <span className="text-[8.5px] font-mono text-[#545d68]">{briefTime ? briefTime.toLocaleTimeString('ko-KR', { hour12: false }) : '--:--:--'}</span>
          </div>
          <div className="px-2.5 py-1.5 space-y-1.5 max-h-[148px] overflow-y-auto">
            {brief.map((b, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: toneColor[b.tone] }} />
                <span className="text-[10px] leading-snug text-[#c9d1d9]">{b.text}</span>
              </div>
            ))}
            {detail && (
              <div className="mt-1 pt-1.5 border-t border-[#30363d]/70 flex items-start gap-1.5">
                <Navigation size={11} className="text-[#58a6ff] mt-0.5 shrink-0" />
                <span className="text-[10px] leading-snug text-[#e6edf3]">
                  <b style={{ color: CATS[detail.cat].color }}>{CATS[detail.cat].label}</b> {detail.name} —
                  <span className="font-mono"> {fmtD(detail.d)}</span> · {detail.dir}쪽 · 도보 ~{detail.walk}분
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Situational summary — air quality + nearest emergency/response assets */}
      <div className="absolute top-2.5 right-2.5 z-[500] w-[182px] bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-[#30363d] flex items-center gap-1.5">
          <ShieldAlert size={11} className="text-[#58a6ff]" />
          <span className="text-[9.5px] font-semibold text-[#8b949e] uppercase tracking-wider">주변 현황 · 대응 자산</span>
        </div>
        <div className="px-2.5 py-1.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#8b949e]">대기질</span>
            <span className="text-[10px] font-medium" style={{ color: risk?.color ?? '#6e7681' }}>{risk?.text ?? '데이터 없음'}</span>
          </div>
          {(([['medical', '최근접 의료'], ['police', '최근접 경찰'], ['fire', '최근접 소방'], ['pharmacy', '최근접 약국']]) as [CatKey, string][]).map(([k, lbl]) => {
            const nx = nearest[k]
            return (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CATS[k].color }} />
                  <span className="text-[10px] text-[#8b949e] truncate" title={nx?.name}>{nx ? nx.name : lbl}</span>
                </span>
                <span className="text-[10px] font-mono text-[#c9d1d9] tabular-nums shrink-0">{nx ? `${fmtD(nx.d)} ${nx.dir}` : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* View + recenter controls */}
      <div className="absolute bottom-2.5 left-2.5 z-[500] flex flex-col gap-1.5">
        <div className="flex bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] overflow-hidden">
          <button onClick={() => setView('light')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'light' ? 'bg-[#137cbd] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}><Layers size={11} /> 2D</button>
          <button onClick={() => setView('sat')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'sat' ? 'bg-[#137cbd] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}><Satellite size={11} /> 위성</button>
        </div>
        <button onClick={recenter} title="시설 중심으로" className="self-start bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] p-1.5 text-[#8b949e] hover:text-[#c9d1d9]"><Locate size={13} /></button>
      </div>

      {/* POI category filters */}
      <div className="absolute bottom-2.5 right-12 z-[500] bg-[#0b0e14]/88 backdrop-blur border border-[#30363d] rounded-[3px] p-2 max-w-[228px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9.5px] font-semibold text-[#8b949e] uppercase tracking-wider">주변 대응 자산</span>
          <button onClick={loadPois} title="새로고침" className="text-[#6e7681] hover:text-[#c9d1d9]"><RefreshCw size={11} className={loadingPois ? 'animate-spin' : ''} /></button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CATS) as CatKey[]).map((k) => {
            const on = active[k]; const n = pois.filter((p) => p.cat === k).length
            return (
              <button key={k} onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${on ? 'text-[#c9d1d9]' : 'text-[#545d68] border-transparent'}`}
                style={on ? { borderColor: CATS[k].color + '88', background: CATS[k].color + '22' } : {}}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? CATS[k].color : '#545d68' }} />
                {CATS[k].label}<span className="font-mono tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        {loadingPois && <p className="text-[9px] text-[#8b949e] mt-1">주변 자산 탐지 중…</p>}
        {poiErr && <p className="text-[9px] text-[#e5484d] mt-1">주변 정보를 불러오지 못했습니다.</p>}
      </div>
    </div>
  )
}
