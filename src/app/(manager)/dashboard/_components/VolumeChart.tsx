'use client'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyPoint } from '../_lib/aggregate'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtBRLk = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : `R$ ${n.toFixed(0)}`

interface Props {
  data: DailyPoint[]
}

export function VolumeChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />

        <XAxis
          dataKey="dia"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v} OS`}
          width={52}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtBRLk}
          width={64}
        />

        <Tooltip
          contentStyle={{
            background: '#0A0F22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
          labelStyle={{ fontFamily: 'Poppins', fontWeight: 700, fontSize: 12, color: '#fff', marginBottom: 6 }}
          itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9AA3BD' }}
          labelFormatter={(label) => `Dia ${label}`}
          formatter={(value: number, name: string) => {
            if (name === 'qtd') return [`${value} OSs`, 'OSs']
            return [fmtBRL(value), 'Receita']
          }}
        />

        <Area
          yAxisId="left"
          type="monotone"
          dataKey="qtd"
          stroke="#00D4FF"
          strokeWidth={2.5}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 5, fill: '#00D4FF', stroke: '#051127', strokeWidth: 2 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="valor"
          stroke="#1E6BFF"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 4, fill: '#1E6BFF' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
