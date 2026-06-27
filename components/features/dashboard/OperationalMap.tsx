'use client'

import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Layers, Locate, MapPin, Navigation, Phone, RefreshCw, Satellite, Search, ShieldAlert, X, Clock, Globe, Footprints, Car, ExternalLink } from 'lucide-react'

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
interface Place {
  lat: number; lon: number; name: string; cat?: CatKey
  phone?: string; website?: string; hours?: string; operator?: string; addr?: string
}
interface Poi extends Place { id: number; cat: CatKey }

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
const fmtDur = (s: number) => (s < 60 ? '1분 미만' : s < 3600 ? `약 ${Math.round(s / 60)}분` : `약 ${Math.floor(s / 3600)}시간 ${Math.round((s % 3600) / 60)}분`)
const telHref = (p: string) => `tel:${p.replace(/[^0-9+]/g, '')}`

// Korea-only viewport so the map never drifts into foreign territory.
const KR_BOUNDS: [[number, number], [number, number]] = [[32.8, 124.4], [39.2, 132.2]]

// VWorld (국토교통부) WMTS — domain-locked client key (exposed in tile URLs by
// design). Override per-deployment with NEXT_PUBLIC_VWORLD_KEY.
const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_KEY || 'CD86EFCF-2317-3FDC-B9F1-EDFB72661516'
const vworld = (layer: string, ext: 'png' | 'jpeg' = 'png') =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`

type RouteInfo = { coords: [number, number][]; dist: number; dur: number; mode: 'foot' | 'car' }

export function OperationalMap({ lat, lng, label, airPm25, airGrade }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  // deno-lint-ignore no-explicit-any
  const mapRef = useRef<any>(null)
  const layerRef = useRef<{ base?: any; sat?: any; markers?: any; rings?: any; selMarker?: any; routeLine?: any; L?: any }>({})
  const [view, setView] = useState<'light' | 'sat'>('light')
  const [pois, setPois] = useState<Poi[]>([])
  const [active, setActive] = useState<Record<CatKey, boolean>>({
    medical: true, pharmacy: true, police: true, fire: true, childcare: true,
    subway: true, mart: true, gov: true, school: false, park: false,
  })
  const [loadingPois, setLoadingPois] = useState(false)
  const [poiErr, setPoiErr] = useState(false)
  const [selected, setSelected] = useState<Place | null>(null)
  const [addr, setAddr] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [routeMode, setRouteMode] = useState<'foot' | 'car'>('foot')
  const [routeLoading, setRouteLoading] = useState(false)
  const [briefTime, setBriefTime] = useState<Date | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [remoteResults, setRemoteResults] = useState<Place[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
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

  const brief = useMemo(() => {
    const items: { tone: 'red' | 'amber' | 'green' | 'blue'; text: string }[] = []
    if (risk) items.push({ tone: risk.level === 'high' ? 'red' : risk.level === 'mid' ? 'amber' : 'green', text: risk.msg })
    const m = nearest.medical
    if (m) items.push({ tone: m.d <= 800 ? 'green' : m.d <= 1500 ? 'amber' : 'red', text: `응급의료 ${m.name} · ${fmtD(m.d)} ${m.dir}쪽 · 도보 ~${walkMin(m.d)}분` })
    const total = pois.filter((p) => active[p.cat]).length
    items.push({ tone: 'blue', text: `반경 1.5km 대응자산 ${total}곳 실시간 탐지` })
    return items
  }, [risk, nearest, pois, active])

  // straight-line fallback distance to the selected place
  const straight = useMemo(() => (selected && hasLoc ? haversine(lat!, lng!, selected.lat, selected.lon) : 0), [selected, hasLoc, lat, lng])

  // ── map init ──────────────────────────────────────────────────────────────
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
      const base = L.tileLayer(vworld('Base'), {
        maxZoom: 19, attribution: '&copy; <a href="https://www.vworld.kr">VWorld</a> · 국토교통부',
      }).addTo(map)
      const sat = L.layerGroup([
        L.tileLayer(vworld('Satellite', 'jpeg'), { maxZoom: 19, attribution: '&copy; VWorld · 국토교통부' }),
        L.tileLayer(vworld('Hybrid'), { maxZoom: 19, opacity: 0.9 }),
      ])
      const rings = L.layerGroup([
        L.circle([lat, lng], { radius: 300, color: '#137cbd', weight: 1, opacity: 0.55, fill: false, dashArray: '4 5' }),
        L.circle([lat, lng], { radius: 700, color: '#137cbd', weight: 1, opacity: 0.34, fill: false, dashArray: '4 5' }),
        L.circle([lat, lng], { radius: 1500, color: '#137cbd', weight: 1, opacity: 0.2, fill: false, dashArray: '4 5' }),
      ]).addTo(map)
      const pin = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html:
        `<div style="position:relative"><span style="position:absolute;inset:-7px;border-radius:999px;background:#137cbd33;animation:lmpulse 2s ease-out infinite"></span><span style="position:absolute;inset:0;border-radius:999px;background:#137cbd;border:2px solid #fff;box-shadow:0 0 0 2px #137cbd,0 1px 4px rgba(0,0,0,.4)"></span></div>` })
      L.marker([lat, lng], { icon: pin, zIndexOffset: 1000 }).addTo(map).bindTooltip(label ?? '우리 시설', { direction: 'top', offset: [0, -10] })
      const markers = L.layerGroup().addTo(map)
      map.on('click', () => { setSelected(null); setSearchOpen(false) })
      layerRef.current = { base, sat, markers, rings, L }
      mapRef.current = map

      // graceful degradation: swap to keyless CartoDB Positron if VWorld fails
      let swapped = false
      base.on('tileerror', () => {
        if (swapped) return
        swapped = true
        const fb = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO',
        })
        if (map.hasLayer(base)) { map.removeLayer(base); fb.addTo(map) }
        layerRef.current.base = fb
      })
      setTimeout(() => map.invalidateSize(), 60)
    })()
    return () => { disposed = true; mapRef.current?.remove?.(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoc])

  useEffect(() => {
    const { base, sat } = layerRef.current
    const map = mapRef.current
    if (!map || !base || !sat) return
    if (view === 'sat') { map.removeLayer(base); sat.addTo(map) } else { map.removeLayer(sat); base.addTo(map) }
  }, [view])

  // ── nearby POIs (Overpass) — race mirrors, refresh every 5 minutes ─────────
  async function loadPois() {
    if (!hasLoc) return
    setLoadingPois(true); setPoiErr(false)
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
        const t = el.tags ?? {}
        const addrParts = [t['addr:province'], t['addr:city'], t['addr:district'], t['addr:borough'], t['addr:street'], t['addr:housenumber']].filter(Boolean)
        out.push({
          id: el.id, lat: plat, lon: plon, cat, name: t.name ?? CATS[cat].label,
          phone: t.phone ?? t['contact:phone'] ?? t['phone:KR'],
          website: t.website ?? t['contact:website'],
          hours: t.opening_hours,
          operator: t.operator,
          addr: t['addr:full'] ?? (addrParts.length ? addrParts.join(' ') : undefined),
        })
      }
      setPois(out)
    } catch { setPoiErr(true) } finally { setLoadingPois(false); setBriefTime(new Date()) }
  }
  useEffect(() => { if (hasLoc) loadPois() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hasLoc])
  useEffect(() => {
    if (!hasLoc) return
    const id = setInterval(() => loadPois(), 5 * 60 * 1000) // 실시간 브리핑 5분 주기 갱신
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoc, lat, lng])

  // ── markers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const { markers, L } = layerRef.current
    if (!markers || !L || !hasLoc) return
    markers.clearLayers()
    for (const p of pois) {
      if (!active[p.cat]) continue
      const c = CATS[p.cat].color
      const icon = L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html:
        `<span class="lm-poi" style="background:${c}26;border-color:${c};box-shadow:0 0 0 1.5px rgba(255,255,255,.85),0 0 7px ${c}66"><i style="background:${c}"></i></span>` })
      const d = haversine(lat!, lng!, p.lat, p.lon)
      const dir = dirOf(bearing(lat!, lng!, p.lat, p.lon))
      L.marker([p.lat, p.lon], { icon }).addTo(markers)
        .bindTooltip(`<b style="color:${c}">${CATS[p.cat].label}</b> · ${p.name}`, { direction: 'top' })
        .on('click', (e: any) => { if (e?.originalEvent) e.originalEvent.stopPropagation?.(); setSelected(p) })
    }
  }, [pois, active, hasLoc, lat, lng])

  // ── selected place: highlight marker + fit + reverse-geocode address ────────
  useEffect(() => {
    const { L } = layerRef.current
    const map = mapRef.current
    if (!map || !L || !hasLoc) return
    if (layerRef.current.selMarker) { map.removeLayer(layerRef.current.selMarker); layerRef.current.selMarker = undefined }
    setAddr(null)
    if (!selected) return
    const c = selected.cat ? CATS[selected.cat].color : '#137cbd'
    const icon = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html:
      `<span class="lm-sel" style="color:${c};box-shadow:0 0 0 2px #fff,0 0 12px ${c}aa"></span>` })
    layerRef.current.selMarker = L.marker([selected.lat, selected.lon], { icon, zIndexOffset: 1200 }).addTo(map)
    try { map.fitBounds(L.latLngBounds([[lat, lng], [selected.lat, selected.lon]]).pad(0.5), { maxZoom: 17 }) }
    catch { map.setView([selected.lat, selected.lon], 16) }
    if (!selected.addr) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ko&lat=${selected.lat}&lon=${selected.lon}`)
        .then((r) => r.json()).then((d) => setAddr(d?.display_name ?? null)).catch(() => {})
    }
  }, [selected, hasLoc, lat, lng])

  // ── road/walking route via public OSRM (FOSSGIS) ───────────────────────────
  useEffect(() => {
    if (!selected || !hasLoc) { setRoute(null); return }
    let cancel = false
    setRouteLoading(true)
    const base = routeMode === 'car' ? 'routed-car/route/v1/driving' : 'routed-foot/route/v1/foot'
    const url = `https://routing.openstreetmap.de/${base}/${lng},${lat};${selected.lon},${selected.lat}?overview=full&geometries=geojson`
    fetch(url).then((r) => { if (!r.ok) throw new Error('route'); return r.json() })
      .then((d) => {
        const rt = d.routes?.[0]; if (!rt) throw new Error('noroute')
        if (!cancel) setRoute({ coords: rt.geometry.coordinates.map((p: number[]) => [p[1], p[0]]), dist: rt.distance, dur: rt.duration, mode: routeMode })
      })
      .catch(() => { if (!cancel) setRoute(null) })
      .finally(() => { if (!cancel) setRouteLoading(false) })
    return () => { cancel = true }
  }, [selected, routeMode, hasLoc, lat, lng])

  // draw the route line
  useEffect(() => {
    const { L } = layerRef.current
    const map = mapRef.current
    if (!map || !L) return
    if (layerRef.current.routeLine) { map.removeLayer(layerRef.current.routeLine); layerRef.current.routeLine = undefined }
    if (route && route.coords.length) {
      layerRef.current.routeLine = L.polyline(route.coords, { color: route.mode === 'car' ? '#d9822b' : '#137cbd', weight: 4, opacity: 0.85, lineCap: 'round' }).addTo(map)
    } else if (selected && hasLoc) {
      // fallback dashed straight line when routing is unavailable
      layerRef.current.routeLine = L.polyline([[lat, lng], [selected.lat, selected.lon]], { color: '#8a9ba8', weight: 2, opacity: 0.7, dashArray: '6 6' }).addTo(map)
    }
  }, [route, selected, hasLoc, lat, lng])

  // ── search (local POIs + Nominatim, debounced) ─────────────────────────────
  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 2 || !hasLoc) { setRemoteResults([]); return }
    const id = setTimeout(async () => {
      try {
        const vb = `${lng! - 0.06},${lat! + 0.05},${lng! + 0.06},${lat! - 0.05}`
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ko&countrycodes=kr&limit=6&q=${encodeURIComponent(q)}&viewbox=${vb}&bounded=0`)
        const d = await r.json()
        setRemoteResults((d ?? []).map((x: any) => ({ lat: +x.lat, lon: +x.lon, name: (x.display_name as string).split(',').slice(0, 2).join(', '), addr: x.display_name })))
      } catch { setRemoteResults([]) }
    }, 350)
    return () => clearTimeout(id)
  }, [searchQ, hasLoc, lat, lng])

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (q.length < 1) return [] as Place[]
    const local = pois.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
    const seen = new Set(local.map((p) => p.name))
    return [...local, ...remoteResults.filter((r) => !seen.has(r.name))].slice(0, 10)
  }, [searchQ, pois, remoteResults])

  function pick(p: Place) { setSelected(p); setSearchOpen(false); setSearchQ(p.name) }
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
  const panel = 'bg-white/92 backdrop-blur-sm border border-[#ced9e0] rounded-[3px] shadow-[0_2px_10px_rgba(16,22,26,0.10)]'

  return (
    <div className="relative isolate h-full w-full rounded-[3px] border border-line overflow-hidden bg-[#e9edf2]">
      <style>{`@keyframes lmpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}
        @keyframes lmlive{0%,100%{opacity:1}50%{opacity:.25}}
        .leaflet-container{background:#e9edf2;font-family:inherit}
        .lm-poi{display:block;width:14px;height:14px;border-radius:50%;border:1.7px solid;position:relative;transition:transform .12s ease;cursor:pointer}
        .lm-poi>i{position:absolute;inset:3.5px;border-radius:50%;display:block}
        .leaflet-marker-icon:hover .lm-poi{transform:scale(1.32)}
        .lm-sel{display:block;width:22px;height:22px;border-radius:50%;border:3px solid currentColor;background:transparent}
        .leaflet-tooltip{background:#fff;border:1px solid #ced9e0;color:#182026;font-size:11px;box-shadow:0 4px 12px rgba(16,22,26,.15)}
        .leaflet-tooltip-top:before{border-top-color:#ced9e0}
        .leaflet-control-zoom a{background:#fff;color:#5c7080;border-color:#ced9e0}
        .leaflet-control-zoom a:hover{background:#f0f3f6}
        .leaflet-control-attribution{background:rgba(255,255,255,.82);color:#8a9ba8;font-size:9px}
        .leaflet-control-attribution a{color:#137cbd}`}</style>
      <div ref={elRef} className="absolute inset-0" />

      {/* Title + live briefing (left stack) */}
      <div className="absolute top-2.5 left-2.5 z-[500] flex flex-col gap-1.5 w-[224px]">
        <div className={`${panel} px-3 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Crosshair size={12} className="text-accent" />
              <span className="text-[11px] font-semibold text-ink tracking-wide uppercase">작전 지도 · Vertex</span>
            </div>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" style={{ animation: 'lmlive 1.6s ease-in-out infinite' }} />
              <span className="text-[8.5px] font-semibold text-[#16a34a] tracking-widest">LIVE</span>
            </span>
          </div>
          <p className="text-[10px] text-ink-faint font-mono mt-0.5 truncate">{label ?? '우리 시설'} · {lat!.toFixed(5)}, {lng!.toFixed(5)}</p>
        </div>

        <div className={`${panel} overflow-hidden`}>
          <div className="px-2.5 py-1.5 border-b border-line flex items-center justify-between">
            <span className="text-[9.5px] font-semibold text-ink-faint uppercase tracking-wider">실시간 상황 브리핑</span>
            <span className="text-[8.5px] font-mono text-ink-ghost">{briefTime ? briefTime.toLocaleTimeString('ko-KR', { hour12: false }) : '--:--:--'}</span>
          </div>
          <div className="px-2.5 py-1.5 space-y-1.5 max-h-[120px] overflow-y-auto">
            {brief.map((b, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: toneColor[b.tone] }} />
                <span className="text-[10px] leading-snug text-ink-soft">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + selected-place info card (top-right) */}
      <div className="absolute top-2.5 right-2.5 z-[600] w-[250px] flex flex-col gap-1.5">
        <div className={`${panel} flex items-center gap-1.5 px-2.5 py-1.5`}>
          <Search size={13} className="text-ink-faint shrink-0" />
          <input
            value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)}
            placeholder="시설·기관·장소 검색" className="flex-1 min-w-0 bg-transparent text-[11.5px] text-ink placeholder:text-ink-ghost outline-none" />
          {searchQ && <button onClick={() => { setSearchQ(''); setRemoteResults([]) }} className="text-ink-faint hover:text-ink shrink-0"><X size={12} /></button>}
        </div>

        {searchOpen && searchResults.length > 0 && (
          <div className={`${panel} overflow-hidden max-h-[208px] overflow-y-auto`}>
            {searchResults.map((p, i) => (
              <button key={i} onClick={() => pick(p)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-fill border-b border-line/70 last:border-0 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.cat ? CATS[p.cat].color : '#8a9ba8' }} />
                <span className="min-w-0">
                  <span className="block text-[11px] text-ink truncate">{p.name}</span>
                  {p.cat && <span className="block text-[9px] text-ink-faint">{CATS[p.cat].label}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className={`${panel} overflow-hidden`}>
            <div className="px-2.5 py-2 border-b border-line flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {selected.cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATS[selected.cat].color }} />}
                  <span className="text-[12px] font-semibold text-ink truncate">{selected.name}</span>
                </div>
                <p className="text-[9.5px] text-ink-faint mt-0.5">{selected.cat ? CATS[selected.cat].label : '검색 위치'}{selected.operator ? ` · ${selected.operator}` : ''}</p>
              </div>
              <button onClick={() => { setSelected(null); setSearchQ('') }} className="text-ink-faint hover:text-ink shrink-0"><X size={13} /></button>
            </div>
            <div className="px-2.5 py-2 space-y-1.5">
              <p className="flex items-start gap-1.5 text-[10.5px] text-ink-soft">
                <MapPin size={11} className="text-ink-faint mt-0.5 shrink-0" />
                <span className="leading-snug">{selected.addr ?? addr ?? '주소 조회 중…'}</span>
              </p>
              {selected.hours && (
                <p className="flex items-center gap-1.5 text-[10.5px] text-ink-soft"><Clock size={11} className="text-ink-faint shrink-0" /><span className="truncate">{selected.hours}</span></p>
              )}
              {/* distance + ETA (road-based) */}
              <p className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
                <Navigation size={11} className="text-accent shrink-0" />
                <span>{routeLoading ? '경로 계산 중…' : route ? `${route.mode === 'car' ? '차량' : '도보'} ${fmtD(route.dist)} · ${fmtDur(route.dur)}` : `직선 ${fmtD(straight)} (도로 경로 없음)`}</span>
              </p>
              {/* mode toggle */}
              <div className="flex items-center gap-1">
                <button onClick={() => setRouteMode('foot')} className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] border transition-colors ${routeMode === 'foot' ? 'bg-accent text-white border-accent' : 'text-ink-soft border-line hover:bg-fill'}`}><Footprints size={11} /> 도보</button>
                <button onClick={() => setRouteMode('car')} className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] border transition-colors ${routeMode === 'car' ? 'bg-accent text-white border-accent' : 'text-ink-soft border-line hover:bg-fill'}`}><Car size={11} /> 차량</button>
              </div>
              {/* actions */}
              <div className="flex items-center gap-1 pt-0.5">
                {selected.phone
                  ? <a href={telHref(selected.phone)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] bg-[#0f9960] text-white hover:opacity-90"><Phone size={11} /> {selected.phone}</a>
                  : <span className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] text-ink-ghost border border-line"><Phone size={11} /> 번호 없음</span>}
                <a href={`https://map.kakao.com/link/to/${encodeURIComponent(selected.name)},${selected.lat},${selected.lon}`} target="_blank" rel="noopener noreferrer"
                  title="카카오맵 길찾기" className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-[3px] text-[10px] bg-[#fee500] text-[#3c1e1e] hover:opacity-90"><ExternalLink size={11} /> 길찾기</a>
              </div>
              {selected.website && (
                <a href={selected.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] text-accent hover:text-accent-hover truncate"><Globe size={11} className="shrink-0" /> <span className="truncate">{selected.website}</span></a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* View + recenter controls */}
      <div className="absolute bottom-2.5 left-2.5 z-[500] flex flex-col gap-1.5">
        <div className={`${panel} flex overflow-hidden`}>
          <button onClick={() => setView('light')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'light' ? 'bg-accent text-white' : 'text-ink-soft hover:bg-fill'}`}><Layers size={11} /> 2D</button>
          <button onClick={() => setView('sat')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'sat' ? 'bg-accent text-white' : 'text-ink-soft hover:bg-fill'}`}><Satellite size={11} /> 위성</button>
        </div>
        <button onClick={recenter} title="시설 중심으로" className={`${panel} self-start p-1.5 text-ink-soft hover:text-ink`}><Locate size={13} /></button>
      </div>

      {/* 주변 현황 + 대응 자산 — placed side by side (bottom-right) */}
      <div className="absolute bottom-2.5 right-12 z-[500] flex gap-1.5 items-end">
        <div className={`${panel} overflow-hidden w-[178px]`}>
          <div className="px-2.5 py-1.5 border-b border-line flex items-center gap-1.5">
            <ShieldAlert size={11} className="text-accent" />
            <span className="text-[9.5px] font-semibold text-ink-faint uppercase tracking-wider">주변 현황</span>
          </div>
          <div className="px-2.5 py-1.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-ink-faint">대기질</span>
              <span className="text-[10px] font-medium" style={{ color: risk?.color ?? '#8a9ba8' }}>{risk?.text ?? '데이터 없음'}</span>
            </div>
            {(([['medical', '최근접 의료'], ['police', '최근접 경찰'], ['fire', '최근접 소방'], ['pharmacy', '최근접 약국']]) as [CatKey, string][]).map(([k, lbl]) => {
              const nx = nearest[k]
              return (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CATS[k].color }} />
                    <span className="text-[10px] text-ink-faint truncate" title={nx?.name}>{nx ? nx.name : lbl}</span>
                  </span>
                  <span className="text-[10px] font-mono text-ink-soft tabular-nums shrink-0">{nx ? `${fmtD(nx.d)} ${nx.dir}` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`${panel} p-2 w-[230px]`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9.5px] font-semibold text-ink-faint uppercase tracking-wider">대응 자산</span>
            <button onClick={loadPois} title="새로고침" className="text-ink-ghost hover:text-ink"><RefreshCw size={11} className={loadingPois ? 'animate-spin' : ''} /></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(CATS) as CatKey[]).map((k) => {
              const on = active[k]; const n = pois.filter((p) => p.cat === k).length
              return (
                <button key={k} onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors ${on ? 'text-ink' : 'text-ink-ghost border-transparent'}`}
                  style={on ? { borderColor: CATS[k].color + '88', background: CATS[k].color + '1f' } : {}}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? CATS[k].color : '#c1ccd6' }} />
                  {CATS[k].label}<span className="font-mono tabular-nums opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
          {loadingPois && <p className="text-[9px] text-ink-faint mt-1">주변 자산 탐지 중…</p>}
          {poiErr && <p className="text-[9px] text-danger mt-1">주변 정보를 불러오지 못했습니다.</p>}
        </div>
      </div>
    </div>
  )
}
