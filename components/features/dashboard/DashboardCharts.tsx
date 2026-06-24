'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const GENDER_COLORS = ['#5a63f2', '#0ea5e9', '#8b5cf6']
const STATUS_COLORS = ['#16a34a', '#d97706', '#e5484d']
const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #e6eaf2', borderRadius: 10, fontSize: 11, boxShadow: '0 8px 24px rgba(14,23,38,0.10)' },
  itemStyle: { color: '#475467' },
  labelStyle: { color: '#0e1726' },
}

interface ChartProps {
  genderStats: { name: string; value: number }[]
  statusStats: { name: string; value: number }[]
  classStats: { name: string; value: number }[]
}

export function DashboardCharts({ genderStats, statusStats, classStats }: ChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle>성별 현황</CardTitle></CardHeader>
        <CardContent>
          {genderStats.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-[12px] text-[#aab2c2]">데이터 없음</div>
          ) : (
            <div className="flex items-center gap-6">
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
                    <span className="text-[11px] text-[#7a8499]">{s.name}</span>
                    <span className="text-[11px] font-medium text-[#1c2740] ml-auto pl-2">{s.value}</span>
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
            <div className="flex items-center justify-center h-36 text-[12px] text-[#aab2c2]">데이터 없음</div>
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
                    <span className="text-[11px] text-[#7a8499]">{s.name}</span>
                    <span className="text-[11px] font-medium text-[#1c2740] ml-auto pl-2">{s.value}</span>
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
            <div className="flex items-center justify-center h-36 text-[12px] text-[#aab2c2]">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={classStats} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9edf4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#7a8499' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(90,99,242,0.06)' }} />
                <Bar dataKey="value" name="아동 수" fill="#5a63f2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  )
}
