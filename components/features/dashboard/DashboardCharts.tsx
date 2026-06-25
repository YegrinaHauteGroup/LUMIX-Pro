'use client'

import { PanelCard } from '@/components/ui/PanelCard'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, Area,
} from 'recharts'

const GENDER_COLORS = ['#137cbd', '#0ea5e9', '#8b5cf6']
const STATUS_COLORS = ['#0f9960', '#d9822b', '#db3737']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #ced9e0', borderRadius: 3, fontSize: 11, boxShadow: '0 8px 24px rgba(16,22,26,0.12)' },
  itemStyle: { color: '#5c7080' }, labelStyle: { color: '#182026', fontWeight: 600 },
}
const GRID = '#e3e9ee'
const AXIS = { fontSize: 10, fill: '#8a9ba8' }

interface Datum { name: string; value: number }
interface TrendDatum { date: string; 출석: number; 지각: number; 결석: number }
interface ChartProps {
  genderStats: Datum[]; statusStats: Datum[]; classStats: Datum[]; ageStats: Datum[]
  attendanceTrend: TrendDatum[]; snaStats: { label: string; value: number }[]
}

function Empty({ h = 150 }: { h?: number }) {
  return <div className="flex items-center justify-center text-[12px] text-ink-ghost" style={{ height: h }}>데이터 없음</div>
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="border border-line rounded-[3px] overflow-hidden">
      <table className="w-full text-[12px]">
        <thead><tr className="bg-fill-2 border-b border-line">
          {cols.map((c) => <th key={c} className="text-left text-[10px] text-ink-faint font-medium uppercase tracking-wider px-3 py-2">{c}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((v, j) => <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'text-ink font-medium' : 'text-ink-soft'}`}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendChart({ data, h }: { data: TrendDatum[]; h: number }) {
  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gPres" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#137cbd" stopOpacity={0.18} /><stop offset="100%" stopColor="#137cbd" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
        <Area type="monotone" dataKey="출석" stroke="#137cbd" strokeWidth={2} fill="url(#gPres)" />
        <Bar dataKey="결석" barSize={7} fill="#db3737" radius={[2, 2, 0, 0]} />
        <Line type="monotone" dataKey="지각" stroke="#d9822b" strokeWidth={1.5} dot={false} />
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
        <Bar dataKey="출석" stackId="a" fill="#0f9960" />
        <Bar dataKey="지각" stackId="a" fill="#d9822b" />
        <Bar dataKey="결석" stackId="a" fill="#db3737" />
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
            <span className="text-[12px] font-semibold text-ink ml-auto">{s.value}</span>
            <span className="text-[10px] text-ink-ghost w-9 text-right">{total ? Math.round((s.value / total) * 100) : 0}%</span>
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
        <Bar dataKey="value" fill="#137cbd" radius={[0, 2, 2, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DashboardCharts({ genderStats, statusStats, classStats, ageStats, attendanceTrend, snaStats }: ChartProps) {
  const trendRows = attendanceTrend.map((d) => [d.date, d.출석, d.지각, d.결석])
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PanelCard title="최근 14일 출결 추이" subtitle="출석·지각·결석 복합 추이"
        detailTitle="출결 추이 상세" detail={
          <div className="space-y-4">
            <TrendChart data={attendanceTrend} h={320} />
            <DataTable cols={['날짜', '출석', '지각', '결석']} rows={trendRows} />
          </div>
        }>
        <TrendChart data={attendanceTrend} h={190} />
      </PanelCard>

      <PanelCard title="출결 구성 비율" subtitle="일별 100% 정규화 구성"
        detailTitle="출결 구성 상세" detail={
          <div className="space-y-4"><CompositionChart data={attendanceTrend} h={320} /><DataTable cols={['날짜', '출석', '지각', '결석']} rows={trendRows} /></div>
        }>
        <CompositionChart data={attendanceTrend} h={190} />
      </PanelCard>

      <PanelCard title="관계망 분석 요약" subtitle="SNA 위험·구조 지표"
        detailTitle="관계망 지표 상세" detail={
          <div className="space-y-4">
            <SnaBars data={snaStats} h={300} />
            <DataTable cols={['지표', '값']} rows={snaStats.map((s) => [s.label, s.value])} />
          </div>
        }>
        <SnaBars data={snaStats} h={190} />
      </PanelCard>

      <PanelCard title="연령 분포" subtitle="재원 아동 연령 구성"
        detailTitle="연령 분포 상세" detail={<div className="space-y-4"><VBar data={ageStats} color="#14b8a6" h={300} /><DataTable cols={['연령', '인원']} rows={ageStats.map((s) => [s.name, s.value])} /></div>}>
        <VBar data={ageStats} color="#14b8a6" h={190} />
      </PanelCard>

      <PanelCard title="성별 현황"
        detailTitle="성별 현황 상세" detail={<div className="space-y-4"><Donut data={genderStats} colors={GENDER_COLORS} h={260} /><DataTable cols={['성별', '인원']} rows={genderStats.map((s) => [s.name, s.value])} /></div>}>
        <Donut data={genderStats} colors={GENDER_COLORS} />
      </PanelCard>

      <PanelCard title="반별 아동 수"
        detailTitle="반별 아동 수 상세" detail={<div className="space-y-4"><VBar data={classStats} color="#137cbd" h={300} /><DataTable cols={['반', '인원']} rows={classStats.map((s) => [s.name, s.value])} /></div>}>
        <VBar data={classStats} color="#137cbd" h={190} />
      </PanelCard>
    </div>
  )
}
