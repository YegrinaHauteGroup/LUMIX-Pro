'use client'

import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Layers, Locate, MapPin, RefreshCw, Satellite, ShieldAlert } from 'lucide-react'

interface Props {
  lat: number | null
  lng: number | null
  label?: string | null
  airPm25?: number | null
  airGrade?: string | null
}

// POI categories pulled from OpenStreetMap (Overpass) — surrounding response
// assets & institutions around the facility.
const CATS: Record<string, { label: string; color: string; q: string[] }> = {
  medical: { label: '의료', color: '#e5484d', q: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'] },
  pharmacy: { label: '약국', color: '#ec4899', q: ['amenity=pharmacy'] },
  police: { label: '경찰', color: '#2563eb', q: ['amenity=police'] },
  fire: { label: '소방', color: '#f97316', q: ['amenity=fire_station'] },
  school: { label: '학교', color: '#16a34a', q: ['amenity=school'] },
  childcare: { label: '보육', color: '#8b5cf6', q: ['amenity=kindergarten', 'amenity=childcare'] },
}
type CatKey = keyof typeof CATS
interface Poi { id: number; lat: number; lon: number; name: string; cat: CatKey }

export function OperationalMap({ lat, lng, label, airPm25, airGrade }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  // deno-lint-ignore no-explicit-any
  const mapRef = useRef<any>(null)
  const layerRef = useRef<{ base?: any; sat?: any; markers?: any; rings?: any; L?: any }>({})
  const [view, setView] = useState<'dark' | 'sat'>('dark')
  const [pois, setPois] = useState<Poi[]>([])
  const [active, setActive] = useState<Record<CatKey, boolean>>({ medical: true, pharmacy: true, police: true, fire: true, school: false, childcare: true })
  const [loadingPois, setLoadingPois] = useState(false)
  const [poiErr, setPoiErr] = useState(false)
  const hasLoc = lat != null && lng != null

  const risk = useMemo(() => {
    const p = airPm25 ?? null
    if (p == null) return null
    const level = p > 75 ? 'high' : p > 35 ? 'mid' : 'low'
    return { level, color: level === 'high' ? '#e5484d' : level === 'mid' ? '#d97706' : '#16a34a', text: `PM2.5 ${Math.round(p)}㎍/㎥ · ${airGrade ?? '-'}` }
  }, [airPm25, airGrade])

  // init map once we have coordinates
  useEffect(() => {
    if (!hasLoc || !elRef.current || mapRef.current) return
    let disposed = false
    ;(async () => {
      const L = (await import('leaflet')).default as any
      if (disposed || !elRef.current) return
      const map = L.map(elRef.current, { center: [lat, lng], zoom: 15, zoomControl: false, attributionControl: true })
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      const base = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map)
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Tiles &copy; Esri',
      })
      // range rings (operational radii)
      const rings = L.layerGroup([
        L.circle([lat, lng], { radius: 300, color: '#58a6ff', weight: 1, opacity: 0.5, fill: false, dashArray: '4 4' }),
        L.circle([lat, lng], { radius: 700, color: '#58a6ff', weight: 1, opacity: 0.32, fill: false, dashArray: '4 4' }),
        L.circle([lat, lng], { radius: 1500, color: '#58a6ff', weight: 1, opacity: 0.2, fill: false, dashArray: '4 4' }),
      ]).addTo(map)
      // facility pin (pulsing)
      const pin = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10], html:
        `<div style="position:relative"><span style="position:absolute;inset:-7px;border-radius:999px;background:#137cbd33;animation:lmpulse 2s ease-out infinite"></span><span style="position:absolute;inset:0;border-radius:999px;background:#137cbd;border:2px solid #fff;box-shadow:0 0 0 2px #137cbd"></span></div>` })
      L.marker([lat, lng], { icon: pin, zIndexOffset: 1000 }).addTo(map).bindTooltip(label ?? '우리 시설', { direction: 'top', offset: [0, -10] })
      const markers = L.layerGroup().addTo(map)
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

  // fetch nearby POIs (Overpass / OpenStreetMap)
  async function loadPois() {
    if (!hasLoc) return
    setLoadingPois(true); setPoiErr(false)
    const filters = Object.entries(CATS).flatMap(([, c]) => c.q.map((q) => `node[${q.replace('=', '="')}"](around:1500,${lat},${lng});`)).join('')
    const query = `[out:json][timeout:20];(${filters});out body 80;`
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query) })
      const data = await res.json()
      const catOf = (tags: Record<string, string>): CatKey | null => {
        const a = tags.amenity
        for (const k of Object.keys(CATS) as CatKey[]) if (CATS[k].q.some((q) => q === `amenity=${a}`)) return k
        return null
      }
      const out: Poi[] = []
      for (const el of data.elements ?? []) {
        const cat = catOf(el.tags ?? {})
        if (!cat || el.lat == null) continue
        out.push({ id: el.id, lat: el.lat, lon: el.lon, name: el.tags?.name ?? CATS[cat].label, cat })
      }
      setPois(out)
    } catch { setPoiErr(true) } finally { setLoadingPois(false) }
  }
  useEffect(() => { if (hasLoc) loadPois() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hasLoc])

  // render filtered markers
  useEffect(() => {
    const { markers, L } = layerRef.current
    if (!markers || !L) return
    markers.clearLayers()
    for (const p of pois) {
      if (!active[p.cat]) continue
      const c = CATS[p.cat].color
      const icon = L.divIcon({ className: '', iconSize: [12, 12], iconAnchor: [6, 6], html:
        `<span style="display:block;width:12px;height:12px;border-radius:2px;background:${c};border:1.5px solid #0b0e14;box-shadow:0 0 6px ${c}aa"></span>` })
      L.marker([p.lat, p.lon], { icon }).addTo(markers)
        .bindTooltip(`<b style="color:${c}">${CATS[p.cat].label}</b> · ${p.name}`, { direction: 'top' })
    }
  }, [pois, active])

  function recenter() { const m = mapRef.current; if (m && hasLoc) m.setView([lat, lng], 15, { animate: true }) }

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

  return (
    <div className="relative h-full w-full rounded-[3px] border border-line overflow-hidden bg-[#0b0e14]">
      <style>{`@keyframes lmpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.4);opacity:0}}
        .leaflet-container{background:#0b0e14;font-family:inherit}
        .leaflet-tooltip{background:#161b22;border:1px solid #30363d;color:#c9d1d9;font-size:11px;box-shadow:0 4px 12px rgba(0,0,0,.5)}
        .leaflet-tooltip-top:before{border-top-color:#30363d}
        .leaflet-control-zoom a{background:#161b22;color:#c9d1d9;border-color:#30363d}
        .leaflet-control-attribution{background:rgba(11,14,20,.7);color:#6e7681;font-size:9px}
        .leaflet-control-attribution a{color:#8b949e}`}</style>
      <div ref={elRef} className="absolute inset-0" />

      {/* Title / coords */}
      <div className="absolute top-2.5 left-2.5 z-[500] bg-[#0b0e14]/85 backdrop-blur border border-[#30363d] rounded-[3px] px-3 py-2 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <Crosshair size={12} className="text-[#58a6ff]" />
          <span className="text-[11px] font-semibold text-[#c9d1d9] tracking-wide uppercase">작전 지도 · Vertex Geospatial</span>
        </div>
        <p className="text-[10px] text-[#8b949e] font-mono mt-0.5">{label ?? '우리 시설'} · {lat!.toFixed(5)}, {lng!.toFixed(5)}</p>
      </div>

      {/* Risk badge */}
      {risk && (
        <div className="absolute top-2.5 right-2.5 z-[500] flex items-center gap-1.5 bg-[#0b0e14]/85 backdrop-blur border rounded-[3px] px-2.5 py-1.5"
          style={{ borderColor: risk.color }}>
          <ShieldAlert size={12} style={{ color: risk.color }} />
          <span className="text-[10.5px] font-medium" style={{ color: risk.color }}>{risk.text}</span>
        </div>
      )}

      {/* View + recenter controls */}
      <div className="absolute bottom-2.5 left-2.5 z-[500] flex flex-col gap-1.5">
        <div className="flex bg-[#0b0e14]/85 backdrop-blur border border-[#30363d] rounded-[3px] overflow-hidden">
          <button onClick={() => setView('dark')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'dark' ? 'bg-[#137cbd] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}><Layers size={11} /> 2D</button>
          <button onClick={() => setView('sat')} className={`px-2.5 py-1.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${view === 'sat' ? 'bg-[#137cbd] text-white' : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}><Satellite size={11} /> 위성</button>
        </div>
        <button onClick={recenter} title="시설 중심으로" className="self-start bg-[#0b0e14]/85 backdrop-blur border border-[#30363d] rounded-[3px] p-1.5 text-[#8b949e] hover:text-[#c9d1d9]"><Locate size={13} /></button>
      </div>

      {/* POI category filters */}
      <div className="absolute bottom-2.5 right-12 z-[500] bg-[#0b0e14]/85 backdrop-blur border border-[#30363d] rounded-[3px] p-2 max-w-[200px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9.5px] font-semibold text-[#8b949e] uppercase tracking-wider">주변 대응 자산</span>
          <button onClick={loadPois} title="새로고침" className="text-[#6e7681] hover:text-[#c9d1d9]"><RefreshCw size={11} className={loadingPois ? 'animate-spin' : ''} /></button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CATS) as CatKey[]).map((k) => {
            const on = active[k]; const n = pois.filter((p) => p.cat === k).length
            return (
              <button key={k} onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] border transition-colors ${on ? 'text-[#c9d1d9]' : 'text-[#545d68] border-transparent'}`}
                style={on ? { borderColor: CATS[k].color + '88', background: CATS[k].color + '22' } : {}}>
                <span className="w-1.5 h-1.5 rounded-[1px]" style={{ background: on ? CATS[k].color : '#545d68' }} />
                {CATS[k].label}<span className="font-mono tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        {poiErr && <p className="text-[9px] text-[#e5484d] mt-1">주변 정보를 불러오지 못했습니다.</p>}
      </div>
    </div>
  )
}
