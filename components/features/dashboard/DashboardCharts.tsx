'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const GENDER_COLORS = ['#888888', '#aaaaaa', '#444444']
const STATUS_COLORS = ['#cccccc', '#666666', '#333333']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 0, fontSize: 11 },
  itemStyle: { color: '#888888' },
}

interface ChartProps {
  genderStats: { name: string; value: number }[]
  statusStats: { name: string; value: number }[]
  classStats: { name: string; value: number }[]
}

export function DashboardCharts({ genderStats, statusStats, classStats }: ChartProps) {
  return (
    <>
      <Card>
        <CardHeader><CardTitle>성별 현황</CardTitle></CardHeader>
        <CardContent>
          {genderStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-[12px] text-[#333333]">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={120}>
                <PieChart>
                  <Pie data={genderStats} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                    {genderStats.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {genderStats.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ background: GENDER_COLORS[i] }} />
                    <span className="text-[11px] text-[#555555]">{s.name}</span>
                    <span className="text-[11px] font-medium text-[#cccccc] ml-auto pl-2">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>재원 현황</CardTitle></CardHeader>
        <CardContent>
          {statusStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-[12px] text-[#333333]">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={120}>
                <PieChart>
                  <Pie data={statusStats} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                    {statusStats.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusStats.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ background: STATUS_COLORS[i] }} />
                    <span className="text-[11px] text-[#555555]">{s.name}</span>
                    <span className="text-[11px] font-medium text-[#cccccc] ml-auto pl-2">{s.value}</span>
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
          {classStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-[12px] text-[#333333]">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={classStats} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#555555' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#555555' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="value" name="아동 수" fill="#555555" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  )
}
