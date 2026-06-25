// ============================================================
// LUMIX Pro - dashboard_feed
// ------------------------------------------------------------
// Location-based dashboard aggregator. Pulls open external data
// for a center's saved facility location and caches it in
// public.dashboard_feeds (read by the dashboard widget every 5 min):
//   * weather   — open-meteo (no API key)
//   * air       — open-meteo air-quality (PM2.5/PM10, no key)
//   * news      — Google News RSS, region + childcare keywords (no key)
//   * policy    — Google News RSS, childcare-policy keywords (no key)
//
// External egress is required and only works in a deployed
// environment. On failure the cache is still written with an error
// note so the UI can degrade gracefully.
//
// Body: { center_id: string }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.47.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } })

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) { const raw = Deno.env.get('SUPABASE_SECRET_KEYS'); if (raw) { try { key = JSON.parse(raw)['sb_secret_5x67m'] } catch { /* ignore */ } } }
  if (!url || !key) throw new Error('SUPABASE_URL / service role key required')
  return createClient(url, key, { auth: { persistSession: false } })
}

const WMO: Record<number, string> = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '서리 안개',
  51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비', 61: '약한 비', 63: '비', 65: '강한 비',
  66: '어는 비', 67: '강한 어는 비', 71: '약한 눈', 73: '눈', 75: '강한 눈', 77: '싸락눈',
  80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈 소나기', 86: '강한 눈 소나기',
  95: '뇌우', 96: '우박 동반 뇌우', 99: '강한 우박 뇌우',
}

async function fetchWeather(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FSeoul&forecast_days=3`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`weather ${r.status}`)
  const d = await r.json()
  const cur = d.current ?? {}
  const daily = d.daily ?? {}
  return {
    current: {
      temp: cur.temperature_2m, feels_like: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
      code: cur.weather_code, summary: WMO[cur.weather_code] ?? '—',
    },
    daily: (daily.time ?? []).map((t: string, i: number) => ({
      date: t, code: daily.weather_code?.[i], summary: WMO[daily.weather_code?.[i]] ?? '—',
      tmax: daily.temperature_2m_max?.[i], tmin: daily.temperature_2m_min?.[i],
      precip: daily.precipitation_probability_max?.[i],
    })),
  }
}

function pm25Grade(v: number | null): string {
  if (v == null) return '—'
  if (v <= 15) return '좋음'
  if (v <= 35) return '보통'
  if (v <= 75) return '나쁨'
  return '매우 나쁨'
}

async function fetchAir(lat: number, lon: number) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=pm10,pm2_5,us_aqi&timezone=Asia%2FSeoul`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`air ${r.status}`)
  const d = await r.json()
  const c = d.current ?? {}
  return { pm10: c.pm10, pm25: c.pm2_5, aqi: c.us_aqi, grade: pm25Grade(c.pm2_5 ?? null) }
}

// Minimal RSS parser (no XML lib): extract <item> title/link/pubDate.
function parseRss(xml: string, limit = 6) {
  const items: { title: string; link: string; date: string; source?: string }[] = []
  const blocks = xml.split('<item>').slice(1)
  for (const b of blocks.slice(0, limit)) {
    const pick = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
      if (!m) return ''
      return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
    }
    const title = pick('title')
    if (title) items.push({ title, link: pick('link'), date: pick('pubDate'), source: pick('source') })
  }
  return items
}

async function fetchNews(query: string, limit = 6) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`news ${r.status}`)
  return parseRss(await r.text(), limit)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  const body = await req.json().catch(() => ({}))
  const { center_id } = body as { center_id?: string }
  if (!center_id) return json({ ok: false, error: 'center_id required' }, 400)

  const sb = serviceClient()
  const { data: center, error: cErr } = await sb.from('centers')
    .select('id, name, address, latitude, longitude, region_name').eq('id', center_id).single()
  if (cErr || !center) return json({ ok: false, error: 'center not found' }, 404)

  const lat = Number(center.latitude), lon = Number(center.longitude)
  const region = center.region_name || center.address || ''
  const location = { lat: center.latitude, lon: center.longitude, label: region || center.name }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    await sb.from('dashboard_feeds').upsert({
      center_id, location, weather: null, news: null, policy: null,
      error: '시설 위치(위도/경도)가 설정되지 않았습니다. 설정에서 위치를 저장하세요.',
      updated_at: new Date().toISOString(),
    })
    return json({ ok: false, error: 'no location set' }, 200)
  }

  const errors: string[] = []
  const [weather, air, news, policy] = await Promise.all([
    fetchWeather(lat, lon).catch((e) => { errors.push(`weather: ${e.message}`); return null }),
    fetchAir(lat, lon).catch((e) => { errors.push(`air: ${e.message}`); return null }),
    fetchNews(`${region || '우리동네'} 보육 어린이집`).catch((e) => { errors.push(`news: ${e.message}`); return null }),
    fetchNews(`보육 정책 영유아 지원 ${region || ''}`).catch((e) => { errors.push(`policy: ${e.message}`); return null }),
  ])

  const payload = {
    center_id, location,
    weather: weather ? { ...weather, air } : null,
    news, policy,
    error: errors.length ? errors.join(' | ') : null,
    updated_at: new Date().toISOString(),
  }
  const { error: upErr } = await sb.from('dashboard_feeds').upsert(payload)
  if (upErr) return json({ ok: false, error: upErr.message }, 500)
  return json({ ok: true, feed: payload })
})
