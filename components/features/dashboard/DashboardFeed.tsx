'use client'

import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface DailyForecast { date: string; summary: string; tmax: number; tmin: number; precip: number }
interface Weather {
  current: { temp: number; feels_like: number; humidity: number; wind: number; summary: string }
  daily: DailyForecast[]
  air?: { pm10: number; pm25: number; aqi: number; grade: string } | null
}
interface NewsItem { title: string; link: string; date: string; source?: string }
interface Feed {
  location: { lat?: number; lon?: number; label?: string }
  weather: Weather | null
  news: NewsItem[] | null
  policy: NewsItem[] | null
  error: string | null
  updated_at: string
}

const REFRESH_MS = 5 * 60 * 1000

export function DashboardFeed({ centerId, hasLocation }: { centerId: string; hasLocation: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    if (!centerId || !hasLocation) { setLoading(false); return }
    try {
      await supabase.functions.invoke('dashboard_feed', { body: { center_id: centerId } })
    } catch { /* edge function refresh is best-effort */ }
    const { data } = await supabase.from('dashboard_feeds').select('*').eq('center_id', centerId).maybeSingle()
    if (data) setFeed(data as Feed)
    setLoading(false)
  }, [centerId, hasLocation, supabase])

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, REFRESH_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [refresh])

  if (!hasLocation) {
    return (
      <Card>
        <CardHeader><CardTitle>지역 정보</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[12px] text-ink-soft">시설 위치가 설정되지 않았습니다. 날씨·미세먼지·지역 뉴스·보육 정책 정보를 받아보려면 위치를 저장하세요.</p>
          <Link href="/settings" className="inline-block mt-3 text-[12px] text-accent hover:text-accent-hover font-medium">설정에서 시설 위치 저장하기 →</Link>
        </CardContent>
      </Card>
    )
  }

  const w = feed?.weather

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>지역 정보 · {feed?.location?.label ?? '우리 시설'}</CardTitle>
        <span className="text-[10px] text-ink-ghost">
          {feed?.updated_at ? `갱신 ${new Date(feed.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''} · 5분 자동
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !feed && <p className="text-[12px] text-ink-faint py-2">지역 정보를 불러오는 중…</p>}

        {/* Weather */}
        {w && (
          <div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-[28px] font-semibold text-ink leading-none">{Math.round(w.current.temp)}°</p>
                <p className="text-[11px] text-ink-faint mt-1">체감 {Math.round(w.current.feels_like)}° · {w.current.summary}</p>
              </div>
              <div className="flex gap-3 text-[11px] text-ink-soft pb-1">
                <span>습도 {w.current.humidity}%</span>
                <span>바람 {Math.round(w.current.wind)}m/s</span>
                {w.air && <span>미세먼지(PM2.5) {Math.round(w.air.pm25)} · {w.air.grade}</span>}
              </div>
            </div>
            {w.daily?.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {w.daily.slice(0, 3).map((d) => (
                  <div key={d.date} className="px-3 py-2 bg-fill-2 border border-line rounded-lg">
                    <p className="text-[10px] text-ink-faint">{new Date(d.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}</p>
                    <p className="text-[12px] text-ink mt-0.5">{d.summary}</p>
                    <p className="text-[11px] text-ink-soft mt-0.5">{Math.round(d.tmax)}° / {Math.round(d.tmin)}° · 강수 {d.precip ?? 0}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* News + policy */}
        <div className="grid grid-cols-2 gap-4">
          <FeedList title="지역 뉴스" items={feed?.news} />
          <FeedList title="보육 정책" items={feed?.policy} />
        </div>

        {feed?.error && !w && (
          <p className="text-[11px] text-ink-faint">외부 정보를 불러오지 못했습니다. 배포 환경에서 자동으로 갱신됩니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

function FeedList({ title, items }: { title: string; items: NewsItem[] | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.1em] mb-2">{title}</p>
      {!items || items.length === 0 ? (
        <p className="text-[12px] text-ink-ghost">표시할 정보가 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((n, i) => (
            <li key={i}>
              <a href={n.link} target="_blank" rel="noreferrer" className="text-[12px] text-ink-soft hover:text-accent leading-snug line-clamp-2 block">
                {n.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
