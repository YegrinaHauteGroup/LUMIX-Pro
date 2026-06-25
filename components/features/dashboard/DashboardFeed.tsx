'use client'

import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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
                <p className="text-[28px] font-semibold text-ink leading-none font-data">{Math.round(w.current.temp)}°</p>
                <p className="text-[11px] text-ink-faint mt-1">체감 {Math.round(w.current.feels_like)}° · {w.current.summary}</p>
              </div>
              <div className="flex gap-3 text-[11px] text-ink-soft pb-1">
                <span>습도 {w.current.humidity}%</span>
                <span>바람 {Math.round(w.current.wind)}m/s</span>
                {w.air && <span>미세먼지(PM2.5) {Math.round(w.air.pm25)} · {w.air.grade}</span>}
              </div>
            </div>
            {w.daily?.length > 0 && (
              <>
                <div className="mt-3 border border-line rounded-[3px] p-2.5">
                  <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider mb-1">기온·강수 분석</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <ComposedChart data={w.daily.map((d) => ({
                      day: new Date(d.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }),
                      최고: Math.round(d.tmax), 최저: Math.round(d.tmin), 강수확률: d.precip ?? 0,
                    }))} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6E7681' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="t" tick={{ fontSize: 10, fill: '#6E7681' }} axisLine={false} tickLine={false} width={28} unit="°" />
                      <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 10, fill: '#6E7681' }} axisLine={false} tickLine={false} width={28} unit="%" domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 3, fontSize: 11 }} itemStyle={{ color: '#C9D1D9' }} labelStyle={{ color: '#C9D1D9' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
                      <Bar yAxisId="p" dataKey="강수확률" barSize={16} fill="#58A6FF" radius={[2, 2, 0, 0]} opacity={0.45} />
                      <Line yAxisId="t" type="monotone" dataKey="최고" stroke="#F85149" strokeWidth={2} dot={{ r: 2 }} />
                      <Line yAxisId="t" type="monotone" dataKey="최저" stroke="#58A6FF" strokeWidth={2} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {w.air && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: '습도', value: `${w.current.humidity}%`, w: w.current.humidity, c: '#58A6FF' },
                      { label: '바람', value: `${Math.round(w.current.wind)}m/s`, w: Math.min(100, w.current.wind * 8), c: '#2dd4bf' },
                      { label: 'PM2.5', value: `${Math.round(w.air.pm25)} ${w.air.grade}`, w: Math.min(100, w.air.pm25), c: w.air.pm25 > 75 ? '#F85149' : w.air.pm25 > 35 ? '#D29922' : '#3FB950' },
                    ].map((m) => (
                      <div key={m.label} className="px-2.5 py-2 bg-fill-2 border border-line rounded-[3px]">
                        <p className="text-[10px] text-ink-faint">{m.label}</p>
                        <p className="text-[12px] text-ink font-medium mt-0.5">{m.value}</p>
                        <div className="h-1 bg-fill rounded-full mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.w}%`, background: m.c }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
