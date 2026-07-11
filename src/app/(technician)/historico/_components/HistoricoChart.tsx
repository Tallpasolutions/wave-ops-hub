'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type MonthData = {
  label: string
  pontos: number
  taxaSucesso: number
}

interface Props {
  data: MonthData[]
}

const fmtPtsk = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n.toFixed(0)}`
const fmtPts = (n: number) =>
  `${Math.round(n).toLocaleString('pt-BR')} pts`

export function HistoricoChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
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
          tickFormatter={fmtPtsk}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: '#0A0F22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
          itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9AA3BD' }}
          formatter={(value: number) => [fmtPts(value), 'Pontos']}
        />
        <Line
          type="monotone"
          dataKey="pontos"
          stroke="#00D4FF"
          strokeWidth={2.5}
          dot={{ fill: '#00D4FF', r: 3, stroke: '#051127', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
