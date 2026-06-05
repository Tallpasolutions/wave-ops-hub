'use client'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { FinancialPoint } from '../_lib/queries'

const fmtBRLk = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : `R$ ${n.toFixed(0)}`

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  data: FinancialPoint[]
}

export function FinanceiroChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="brl"
          orientation="left"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtBRLk}
          width={64}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={44}
          domain={[0, 100]}
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
          formatter={(value: number, name: string) => {
            if (name === 'margemPct') return [`${value}%`, 'Margem %']
            if (name === 'receita') return [fmtBRL(value), 'Receita Unetvale']
            if (name === 'pago') return [fmtBRL(value), 'Pago técnicos']
            return [value, name]
          }}
        />

        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = {
              receita: 'Receita Unetvale',
              pago: 'Pago técnicos',
              margemPct: 'Margem %',
            }
            return labels[value] ?? value
          }}
          wrapperStyle={{ fontSize: 11, color: '#5A6385' }}
        />

        <Bar
          yAxisId="brl"
          dataKey="receita"
          fill="#00D4FF"
          fillOpacity={0.7}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          yAxisId="brl"
          dataKey="pago"
          fill="#1E6BFF"
          fillOpacity={0.7}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="margemPct"
          stroke="#F59E0B"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#F59E0B', stroke: '#051127', strokeWidth: 2 }}
          activeDot={{ r: 5, fill: '#F59E0B' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
