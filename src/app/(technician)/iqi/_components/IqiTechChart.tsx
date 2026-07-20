'use client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type Point = { label: string; pctReincidencia: number }

interface Props {
  data: Point[]
}

// Linha do IQI (% de reincidência) do técnico ao longo dos meses. Menor é melhor.
export function IqiTechChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#0A0F22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
          itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9AA3BD' }}
          formatter={(value: number) => [`${value}%`, 'Reincidência']}
        />
        <Line
          type="monotone"
          dataKey="pctReincidencia"
          stroke="#FFB547"
          strokeWidth={2.5}
          dot={{ fill: '#FFB547', r: 3, stroke: '#051127', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
