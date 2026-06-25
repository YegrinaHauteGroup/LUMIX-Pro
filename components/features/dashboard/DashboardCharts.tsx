'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts'

const GENDER_COLORS = ['#2563eb', '#0ea5e9', '#8b5cf6']
const STATUS_COLORS = ['#10b981', '#f59e0b', '#f43f5e']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #e6eaf2', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 24px rgba(14,23,38,0.10)' },
  itemStyle: { color: '#475467' },
  labelStyle: { color: '#0e1726', fontWeight: 600 },
}

interface Datum { name: string; value: number }
interface TrendDatum { date: string; 출석: number; 지각: number; 결석: number }
interface ChartProps {
  genderStats: Datum[]
  statusStats: Datum[]
  classStats: Datum[]
  ageStats: Datum[]
  attendanceTrend: TrendDatum[]
  snaStats: { label: string; value: number }[]
}

function Empty() {
  return <div className="flex items-center justify-center h-[160px] text-[12px] text-ink-ghost">데이터 없음</div>
}

function Donut({ data, colors }: { data: Datum[]; colors: string[] }) {
  if (data.length === 0) return <Empty />
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <div className="flex items-center gap-5">
      <ResponsiveContainer width="55%" height={170}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={2} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 flex-1">
        {data.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />
            <span className="text-[12px] text-ink-soft">{s.name}</span>
            <span className="text-[12px] font-semibold text-ink ml-auto">{s.value}</span>
            <span className="text-[10px] text-ink-ghost w-9 text-right">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VBar({ data, color }: { data: Datum[]; color: string }) {
  if (data.length === 0) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
        <Bar dataKey="value" name="아동 수" fill={color} radius={[4, 4, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DashboardCharts({ genderStats, statusStats, classStats, ageStats, attendanceTrend, snaStats }: ChartProps) {
  return (
    <div className="space-y-4">
      {/* Row A: attendance trend (wide) + SNA summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>최근 14일 출결 추이</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={attendanceTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="출석" stroke="#2563eb" strokeWidth={2} fill="url(#gPresent)" />
                <Area type="monotone" dataKey="지각" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={0} />
                <Area type="monotone" dataKey="결석" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>관계망 분석 요약</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {snaStats.map((s) => (
                <div key={s.label} className="bg-fill-2 border border-line rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-ink-faint">{s.label}</p>
                  <p className="text-xl font-semibold text-ink mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row B: distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>성별 현황</CardTitle></CardHeader>
          <CardContent><Donut data={genderStats} colors={GENDER_COLORS} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>재원 현황</CardTitle></CardHeader>
          <CardContent><Donut data={statusStats} colors={STATUS_COLORS} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>연령 분포</CardTitle></CardHeader>
          <CardContent><VBar data={ageStats} color="#14b8a6" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>반별 아동 수</CardTitle></CardHeader>
          <CardContent><VBar data={classStats} color="#2563eb" /></CardContent>
        </Card>
      </div>
    </div>
  )
}
