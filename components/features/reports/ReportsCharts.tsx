'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const PIE_COLORS = ['#5a63f2', '#0ea5e9', '#16a34a', '#d97706', '#8b5cf6']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #e6eaf2', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 24px rgba(14,23,38,0.10)' },
  itemStyle: { color: '#475467' },
  labelStyle: { color: '#0e1726' },
}

interface Props {
  monthlyData: { month: string; 등록: number }[]
  activityTypeData: { name: string; value: number }[]
  classSizeData: { name: string; 아동수: number }[]
}

export function ReportsCharts({ monthlyData, activityTypeData, classSizeData }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="col-span-2">
        <CardHeader><CardTitle>월별 아동 등록 현황 (최근 6개월)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5a63f2" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#5a63f2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#7a8499' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#7a8499' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="등록" stroke="#5a63f2" strokeWidth={2} fill="url(#regGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>활동 유형 분포</CardTitle></CardHeader>
        <CardContent>
          {activityTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[12px] text-[#aab2c2]">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={activityTypeData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2} dataKey="value">
                    {activityTypeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {activityTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-[11px] text-[#7a8499]">{d.name}</span>
                    <span className="text-[11px] font-medium text-[#1c2740] ml-auto pl-2">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>반별 아동 수</CardTitle></CardHeader>
        <CardContent>
          {classSizeData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[12px] text-[#aab2c2]">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classSizeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(90,99,242,0.06)' }} />
                <Bar dataKey="아동수" fill="#5a63f2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
