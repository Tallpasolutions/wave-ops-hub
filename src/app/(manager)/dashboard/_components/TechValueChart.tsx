'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { TecnicoRow } from '../_lib/aggregate'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtBRLk = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : `R$ ${n.toFixed(0)}`

interface Props {
  data: TecnicoRow[]
}

export function TechValueChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 8)
  const chartData = sorted.map((t) => ({
    nome: t.nome.split(' ').slice(0, 2).join(' '),
    valor: t.valorTotal,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#5A6385', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtBRLk}
        />
        <YAxis
          type="category"
          dataKey="nome"
          tick={{ fontSize: 11, fill: '#9AA3BD', fontFamily: 'Manrope' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{
            background: '#0A0F22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
          itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9AA3BD' }}
          formatter={(value: number) => [fmtBRL(value), 'Valor gerado']}
        />
        <Bar dataKey="valor" radius={6} barSize={18}>
          {chartData.map((_, i) => (
            <Cell
              key={i}
              fill="url(#barGrad)"
            />
          ))}
        </Bar>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#1E6BFF" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}
