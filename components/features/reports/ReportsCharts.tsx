'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#94a3b8']

interface Props {
  monthlyData: { month: string; 등록: number }[]
  activityTypeData: { name: string; value: number }[]
  classSizeData: { name: string; 아동수: number }[]
}

export function ReportsCharts({ monthlyData, activityTypeData, classSizeData }: Props) {
  const tooltipStyle = {
    contentStyle: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 },
    itemStyle: { color: '#a0a0a0' },
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Monthly registrations */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>월별 아동 등록 현황 (최근 6개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="등록"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#regGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity types */}
      <Card>
        <CardHeader><CardTitle>활동 유형 분포</CardTitle></CardHeader>
        <CardContent>
          {activityTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-[#444444]">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={activityTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {activityTypeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {activityTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-xs text-[#a0a0a0]">{d.name}</span>
                    <span className="text-xs font-medium text-[#f5f5f5] ml-auto pl-2">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class sizes */}
      <Card>
        <CardHeader><CardTitle>반별 아동 수</CardTitle></CardHeader>
        <CardContent>
          {classSizeData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-[#444444]">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classSizeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="아동수" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
