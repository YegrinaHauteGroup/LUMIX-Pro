'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PanelCard } from '@/components/ui/PanelCard'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, Area, ReferenceLine, AreaChart,
} from 'recharts'

const GENDER_COLORS = ['#3b7fb0', '#4596b8', '#6b6fae']
const STATUS_COLORS = ['#3f9e7c', '#c08a3e', '#b85c4f']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #ced9e0', borderRadius: 3, fontSize: 11, boxShadow: '0 8px 24px rgba(16,22,26,0.12)' },
  itemStyle: { color: '#5c7080', fontVariantNumeric: 'tabular-nums' }, labelStyle: { color: '#182026', fontWeight: 600 },
}
const GRID = '#e3e9ee'
const AXIS = { fontSize: 10, fill: '#8a9ba8' }

interface Datum { name: string; value: number }
interface TrendDatum { date: string; 출석: number; 지각: number; 조퇴: number; 결석: number }
interface MonthlyDatum { month: string; 등록: number }
interface ChartProps {
  genderStats: Datum[]; statusStats: Datum[]; classStats: Datum[]; ageStats: Datum[]
  attendanceTrend: TrendDatum[]; snaStats: { label: string; value: number }[]
  snaTotal?: number
  monthlyData?: MonthlyDatum[]; activityTypeData?: Datum[]
}

function MonthlyArea({ data, h }: { data: MonthlyDatum[]; h: number }) {
  if (data.length === 0) return <Empty h={h} />
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b7fb0" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b7fb0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ stroke: '#ced9e0' }} />
        <Area type="monotone" dataKey="등록" stroke="#3b7fb0" strokeWidth={2} fill="url(#gReg)" dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function Empty({ h = 150 }: { h?: number }) {
  return <div className="flex items-center justify-center text-[12px] text-ink-ghost" style={{ height: h }}>데이터 없음</div>
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="border border-line rounded-[3px] overflow-hidden">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-fill-2 border-b border-line">
          {cols.map((c, j) => <th key={c} className={`text-[10px] text-ink-faint font-semibold uppercase tracking-wider px-3 py-2 ${j === 0 ? 'text-left' : 'text-right'}`}>{c}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-fill-2/60 transition-colors">
              {r.map((v, j) => <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-ink font-medium' : 'text-ink-soft text-right font-data tabular-nums'}`}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendChart({ data, h, compact }: { data: TrendDatum[]; h: number | `${number}%`; compact?: boolean }) {
  const avg = data.length ? data.reduce((a, b) => a + b.출석, 0) / data.length : 0
  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={data} margin={{ top: 6, right: compact ? 8 : 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="gPres" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b7fb0" stopOpacity={0.25} /><stop offset="100%" stopColor="#3b7fb0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: compact ? 9 : 10, fill: '#8a9ba8' }} axisLine={false} tickLine={false} interval={compact ? 0 : 1} minTickGap={4} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
        <Tooltip {...TOOLTIP_STYLE} />
        {!compact && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />}
        {avg > 0 && (
          <ReferenceLine y={avg} stroke="#3b7fb0" strokeDasharray="4 4" strokeOpacity={0.5}
            label={compact ? undefined : { value: `μ ${avg.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#5c7080' }} />
        )}
        <Area type="monotone" dataKey="출석" stroke="#3b7fb0" strokeWidth={2} fill="url(#gPres)" dot={false} activeDot={{ r: 3 }} />
        <Bar dataKey="결석" barSize={7} fill="#b85c4f" radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="지각" stroke="#c08a3e" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="조퇴" stroke="#6b6fae" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// Compact bottom-bar chart: present count varies little day-to-day (~90/100),
// so on a 0-based shared axis every series looks flat. Here the 출석 line gets
// its own zoomed left axis (so its variation is visible) while 결석/지각 ride a
// hidden 0-based right axis.
function CompactTrend({ data, h }: { data: TrendDatum[]; h: number | `${number}%` }) {
  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: -26, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8a9ba8' }} axisLine={false} tickLine={false} interval={1} minTickGap={4} />
        <YAxis yAxisId="p" domain={[(m: number) => Math.max(0, Math.floor(m - 2)), (m: number) => Math.ceil(m + 2)]} tick={AXIS} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
        <YAxis yAxisId="a" orientation="right" domain={[0, (m: number) => Math.max(4, Math.ceil(m * 1.5))]} hide />
        <Tooltip {...TOOLTIP_STYLE} />
        <Bar yAxisId="a" dataKey="결석" barSize={6} fill="#b85c4f" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="a" dataKey="지각" barSize={6} fill="#c08a3e" radius={[2, 2, 0, 0]} />
        <Line yAxisId="p" type="monotone" dataKey="출석" stroke="#3b7fb0" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function CompositionChart({ data, h }: { data: TrendDatum[]; h: number }) {
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }} stackOffset="expand">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={26} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
        <Bar dataKey="출석" stackId="a" fill="#3f9e7c" />
        <Bar dataKey="지각" stackId="a" fill="#c08a3e" />
        <Bar dataKey="조퇴" stackId="a" fill="#6b6fae" />
        <Bar dataKey="결석" stackId="a" fill="#b85c4f" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function Donut({ data, colors, h = 160 }: { data: Datum[]; colors: string[]; h?: number }) {
  if (data.length === 0) return <Empty h={h} />
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="52%" height={h}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={h * 0.26} outerRadius={h * 0.42} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 flex-1">
        {data.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: colors[i % colors.length] }} />
            <span className="text-[12px] text-ink-soft">{s.name}</span>
            <span className="text-[12px] font-semibold text-ink ml-auto font-data tabular-nums">{s.value}</span>
            <span className="text-[10px] text-ink-ghost w-9 text-right font-data tabular-nums">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VBar({ data, color, h = 160 }: { data: Datum[]; color: string; h?: number }) {
  if (data.length === 0) return <Empty h={h} />
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(19,124,189,0.06)' }} />
        <Bar dataKey="value" name="아동 수" fill={color} radius={[2, 2, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function SnaBars({ data, h = 160 }: { data: { label: string; value: number }[]; h?: number }) {
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#5c7080' }} axisLine={false} tickLine={false} width={66} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(19,124,189,0.06)' }} />
        <Bar dataKey="value" fill="#3b7fb0" radius={[0, 2, 2, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Stand-alone wide panel: the 14-day attendance trend (kept full-width on the dashboard). */
export function AttendanceTrendPanel({ attendanceTrend, compact }: { attendanceTrend: TrendDatum[]; compact?: boolean }) {
  const trendRows = attendanceTrend.map((d) => [d.date, d.출석, d.지각, d.조퇴, d.결석])
  const scrollRef = useRef<HTMLDivElement>(null)
  const nudge = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' })
  return (
    <PanelCard title="최근 14일 출결 추이" subtitle="출석·지각·결석 복합 추이"
      dragTable={{ cols: ['날짜', '출석', '지각', '조퇴', '결석'], rows: trendRows }}
      className={compact ? 'h-full min-h-0' : undefined}
      bodyClassName={compact ? 'min-h-0 !px-1 !py-1.5' : undefined}
      headerRight={compact ? (
        <div className="flex items-center gap-0.5">
          <button onClick={() => nudge(-180)} title="이전" className="w-6 h-6 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill"><ChevronLeft size={14} /></button>
          <button onClick={() => nudge(180)} title="다음" className="w-6 h-6 flex items-center justify-center rounded-[3px] text-ink-faint hover:text-ink hover:bg-fill"><ChevronRight size={14} /></button>
        </div>
      ) : undefined}
      detailTitle="출결 추이 상세" detail={
        <div className="space-y-4">
          <TrendChart data={attendanceTrend} h={320} />
          <DataTable cols={['날짜', '출석', '지각', '조퇴', '결석']} rows={trendRows} />
        </div>
      }>
      {compact
        ? (
          <div ref={scrollRef} className="h-full w-full min-h-0 overflow-x-auto overflow-y-hidden no-scrollbar">
            <div style={{ minWidth: 660, height: '100%' }}><CompactTrend data={attendanceTrend} h="100%" /></div>
          </div>
        )
        : <TrendChart data={attendanceTrend} h={208} />}
    </PanelCard>
  )
}

export function DashboardCharts({ genderStats, statusStats, classStats, ageStats, attendanceTrend, snaStats, snaTotal, monthlyData, activityTypeData, layout = 'grid' }: ChartProps & { layout?: 'grid' | 'stack' }) {
  const trendRows = attendanceTrend.map((d) => [d.date, d.출석, d.지각, d.조퇴, d.결석])
  return (
    <div className={layout === 'stack' ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
      {monthlyData && (
        <PanelCard title="월별 아동 등록 추이" subtitle="최근 6개월 신규 등록"
          dragTable={{ cols: ['월', '등록'], rows: monthlyData.map((d) => [d.month, d.등록]) }}
          detailTitle="월별 등록 추이 상세" detail={
            <div className="space-y-4"><MonthlyArea data={monthlyData} h={300} /><DataTable cols={['월', '등록']} rows={monthlyData.map((d) => [d.month, d.등록])} /></div>
          }>
          <MonthlyArea data={monthlyData} h={150} />
        </PanelCard>
      )}

      {activityTypeData && (
        <PanelCard title="활동 유형 분포" subtitle="프로그램 유형별 구성"
          dragTable={{ cols: ['유형', '건수'], rows: activityTypeData.map((d) => [d.name, d.value]) }}
          detailTitle="활동 유형 분포 상세" detail={
            <div className="space-y-4"><Donut data={activityTypeData} colors={['#3b7fb0', '#6b6fae', '#3f9e7c', '#c08a3e', '#5c7080']} h={260} /><DataTable cols={['유형', '건수']} rows={activityTypeData.map((d) => [d.name, d.value])} /></div>
          }>
          <Donut data={activityTypeData} colors={['#3b7fb0', '#6b6fae', '#3f9e7c', '#c08a3e', '#5c7080']} h={150} />
        </PanelCard>
      )}

      <PanelCard title="출결 구성 비율" subtitle="일별 100% 정규화 구성"
        dragTable={{ cols: ['날짜', '출석', '지각', '조퇴', '결석'], rows: trendRows }}
        detailTitle="출결 구성 상세" detail={
          <div className="space-y-4"><CompositionChart data={attendanceTrend} h={320} /><DataTable cols={['날짜', '출석', '지각', '조퇴', '결석']} rows={trendRows} /></div>
        }>
        <CompositionChart data={attendanceTrend} h={170} />
      </PanelCard>

      <PanelCard title="관계망 분석 요약" subtitle="SNA 위험·구조 지표"
        dragTable={{ cols: ['지표', '값'], rows: [...(snaTotal != null ? [['분석 아동', snaTotal] as [string, number]] : []), ...snaStats.map((s) => [s.label, s.value] as [string, number])] }}
        detailTitle="관계망 지표 상세" detail={
          <div className="space-y-4">
            {snaTotal != null && <p className="text-[13px] text-ink-soft">분석 대상 아동 <strong className="text-ink text-[16px]">{snaTotal}</strong>명 · 아래는 위험·구조 이벤트 신호입니다.</p>}
            <SnaBars data={snaStats} h={300} />
            <DataTable cols={['지표', '값']} rows={snaStats.map((s) => [s.label, s.value])} />
          </div>
        }>
        {/* analyzed-child count is shown separately so the event-signal bars
            (much smaller) are not dwarfed on a shared scale */}
        {snaTotal != null && (
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <span className="text-[11px] text-ink-faint">분석 아동</span>
            <span className="text-[18px] font-semibold text-ink tabular-nums">{snaTotal}<span className="text-[11px] text-ink-faint ml-0.5">명</span></span>
          </div>
        )}
        <SnaBars data={snaStats} h={150} />
      </PanelCard>

      <PanelCard title="연령 분포" subtitle="재원 아동 연령 구성"
        dragTable={{ cols: ['연령', '인원'], rows: ageStats.map((s) => [s.name, s.value]) }}
        detailTitle="연령 분포 상세" detail={<div className="space-y-4"><VBar data={ageStats} color="#2f8f9d" h={300} /><DataTable cols={['연령', '인원']} rows={ageStats.map((s) => [s.name, s.value])} /></div>}>
        <VBar data={ageStats} color="#2f8f9d" h={170} />
      </PanelCard>

      <PanelCard title="성별 현황"
        dragTable={{ cols: ['성별', '인원'], rows: genderStats.map((s) => [s.name, s.value]) }}
        detailTitle="성별 현황 상세" detail={<div className="space-y-4"><Donut data={genderStats} colors={GENDER_COLORS} h={260} /><DataTable cols={['성별', '인원']} rows={genderStats.map((s) => [s.name, s.value])} /></div>}>
        <Donut data={genderStats} colors={GENDER_COLORS} h={150} />
      </PanelCard>

      <PanelCard title="재원 상태"
        dragTable={{ cols: ['상태', '인원'], rows: statusStats.map((s) => [s.name, s.value]) }}
        detailTitle="재원 상태 상세" detail={<div className="space-y-4"><Donut data={statusStats} colors={STATUS_COLORS} h={260} /><DataTable cols={['상태', '인원']} rows={statusStats.map((s) => [s.name, s.value])} /></div>}>
        <Donut data={statusStats} colors={STATUS_COLORS} h={150} />
      </PanelCard>

      <PanelCard title="반별 아동 수"
        dragTable={{ cols: ['반', '인원'], rows: classStats.map((s) => [s.name, s.value]) }}
        detailTitle="반별 아동 수 상세" detail={<div className="space-y-4"><VBar data={classStats} color="#3b7fb0" h={300} /><DataTable cols={['반', '인원']} rows={classStats.map((s) => [s.name, s.value])} /></div>}>
        <VBar data={classStats} color="#3b7fb0" h={170} />
      </PanelCard>
    </div>
  )
}
