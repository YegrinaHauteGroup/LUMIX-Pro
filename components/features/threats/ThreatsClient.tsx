'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { createClient } from '@/utils/supabase/client'
import { AlertTriangle, Activity, RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

interface Threat {
  category: string; severity: 'high' | 'medium' | 'low'
  title: string; detail: string; subjects: string[]; score: number
}
interface ThreatData {
  threats: Threat[]
  summary: { total: number; high: number; medium: number; low: number }
}
interface Props { centerId: string; initial: ThreatData | null }

const SEV = {
  high: { label: '높음', dot: '#db3737', chip: 'text-[#db3737] bg-[#fbeaea] border border-[#f5cccc]', bar: 'border-l-[#db3737]' },
  medium: { label: '중간', dot: '#d9822b', chip: 'text-[#bf7326] bg-[#fdf3e7] border border-[#f5dcb8]', bar: 'border-l-[#d9822b]' },
  low: { label: '낮음', dot: '#0f9960', chip: 'text-[#0d8050] bg-[#e8f5ef] border border-[#bfe0cf]', bar: 'border-l-[#0f9960]' },
}
const CAT_ICON: Record<string, typeof Activity> = {
  health: Activity, conflict: Users, isolation: Users, allergy: AlertTriangle,
  attendance: Users, supervision: ShieldAlert, environment: AlertTriangle,
}

export function ThreatsClient({ centerId, initial }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<ThreatData | null>(initial)
  const [loading, setLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date())

  async function refresh() {
    setLoading(true)
    const { data: d } = await supabase.rpc('get_threats', { p_center_id: centerId })
    if (d) setData(d as ThreatData)
    setRefreshedAt(new Date())
    setLoading(false)
  }

  const s = data?.summary ?? { total: 0, high: 0, medium: 0, low: 0 }

  return (
    <div className="flex-1 min-h-0 p-5 w-full space-y-4 overflow-auto">
      {/* Summary bar */}
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-4 gap-3 flex-1">
          {[
            { label: '총 위협', value: s.total, color: 'text-ink' },
            { label: '높음', value: s.high, color: 'text-[#db3737]' },
            { label: '중간', value: s.medium, color: 'text-[#d9822b]' },
            { label: '낮음', value: s.low, color: 'text-[#0f9960]' },
          ].map((m) => (
            <div key={m.label} className="bg-surface border border-line rounded-[3px] shadow-[var(--shadow-card)] px-4 py-3">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">{m.label}</p>
              <p className={`text-2xl font-semibold mt-0.5 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <button onClick={refresh} disabled={loading}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[3px] bg-accent text-white text-[12px] font-medium hover:bg-accent-hover disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 재탐지
        </button>
      </div>
      <p className="text-[11px] text-ink-ghost">최종 탐지 {refreshedAt.toLocaleTimeString('ko-KR')} · SNA·보건·출결·위치 데이터 종합</p>

      {/* Threat list */}
      {!data || data.threats.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-ink-faint">
              <ShieldCheck size={36} className="text-[#0f9960] mb-3" />
              <p className="text-[13px] text-ink">감지된 위협이 없습니다</p>
              <p className="text-[11px] text-ink-ghost mt-1">관계망·보건·출결 데이터가 정상 범위입니다.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {data.threats.map((t, i) => {
            const sev = SEV[t.severity]
            const Icon = CAT_ICON[t.category] ?? AlertTriangle
            return (
              <div key={i} className={`bg-surface border border-line border-l-[3px] ${sev.bar} rounded-[3px] shadow-[var(--shadow-card)] p-4`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={15} style={{ color: sev.dot }} className="shrink-0" />
                    <span className="text-[13.5px] font-semibold text-ink truncate">{t.title}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] shrink-0 ${sev.chip}`}>{sev.label}</span>
                </div>
                <p className="text-[12px] text-ink-soft leading-relaxed mb-3">{t.detail}</p>
                {t.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.subjects.slice(0, 12).map((name, k) => (
                      <span key={k} className="text-[11px] text-ink-soft bg-fill border border-line rounded-[3px] px-1.5 py-0.5">{name}</span>
                    ))}
                    {t.subjects.length > 12 && <span className="text-[10px] text-ink-ghost self-center">+{t.subjects.length - 12}</span>}
                  </div>
                )}
                <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between">
                  <span className="text-[10px] text-ink-ghost uppercase tracking-wider">위험 점수</span>
                  <span className="text-[12px] font-semibold" style={{ color: sev.dot }}>{t.score}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
