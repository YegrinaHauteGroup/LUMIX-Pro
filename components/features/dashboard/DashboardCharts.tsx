'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

const GENDER_COLORS = ['#6366f1', '#ec4899', '#94a3b8']
const STATUS_COLORS = ['#22c55e', '#f59e0b', '#ef4444']
const CLASS_COLOR = '#6366f1'

interface ChartProps {
  genderStats: { name: string; value: number }[]
  statusStats: { name: string; value: number }[]
  classStats: { name: string; value: number }[]
}

export function DashboardCharts({ genderStats, statusStats, classStats }: ChartProps) {
  return (
    <>
      {/* Gender distribution */}
      <Card>
        <CardHeader>
          <CardTitle>성별 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {genderStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-sm text-[#444444]">
              데이터 없음
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={120}>
                <PieChart>
                  <Pie
                    data={genderStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {genderStats.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#a0a0a0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {genderStats.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: GENDER_COLORS[i] }} />
                    <span className="text-xs text-[#a0a0a0]">{s.name}</span>
                    <span className="text-xs font-medium text-[#f5f5f5] ml-auto pl-2">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>재원 현황</CardTitle>
        </CardHeader>
        <CardContent>
          {statusStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-sm text-[#444444]">
              데이터 없음
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={120}>
                <PieChart>
                  <Pie
                    data={statusStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusStats.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#a0a0a0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusStats.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[i] }} />
                    <span className="text-xs text-[#a0a0a0]">{s.name}</span>
                    <span className="text-xs font-medium text-[#f5f5f5] ml-auto pl-2">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class distribution */}
      <Card>
        <CardHeader>
          <CardTitle>반별 아동 수</CardTitle>
        </CardHeader>
        <CardContent>
          {classStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-sm text-[#444444]">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={classStats} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#a0a0a0' }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                />
                <Bar dataKey="value" name="아동 수" fill={CLASS_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  )
}
