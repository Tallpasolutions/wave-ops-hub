'use client'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { IqiTrendPoint } from '@/lib/iqi'

interface Props {
  data: IqiTrendPoint[]
}

// IQI = % de contratos com atendimento reincidente (menor é melhor). Barras = volume
// de OSs; linha = o indicador. Espelha a visualização da Unetvale (ADR-012).
export function IqiTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />

        <XAxis
          dataKey="label"
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
          tickFormatter={(v) => `${v}%`}
          width={44}
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
            if (name === 'totalOs') return [`${value} OSs`, 'Total de OSs']
            if (name === 'contratosReincidentes') return [`${value}`, 'Reincidentes']
            return [`${value}%`, 'IQI (reincidência)']
          }}
        />

        <Bar yAxisId="left" dataKey="totalOs" fill="rgba(0,212,255,0.22)" radius={[4, 4, 0, 0]} maxBarSize={38} />
        <Bar
          yAxisId="left"
          dataKey="contratosReincidentes"
          fill="rgba(255,84,112,0.55)"
          radius={[4, 4, 0, 0]}
          maxBarSize={38}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="pctReincidencia"
          stroke="#FFB547"
          strokeWidth={2.5}
          dot={{ fill: '#FFB547', r: 3, stroke: '#051127', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
