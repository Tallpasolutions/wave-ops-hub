'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { TipoAtendimentoRow } from '../_lib/aggregate'
import { useDrilldown } from '../_lib/useDrilldown'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  data: TipoAtendimentoRow[]
  total: number
}

const COLORS = ['#00D4FF', 'rgba(255,255,255,0.12)']

export function AttendanceDonut({ data, total }: Props) {
  const { drill, activeOf } = useDrilldown()
  const activeTipo = activeOf('tipo')
  const externo = data.find((d) => d.tipo === 'Externo')
  const interno = data.find((d) => d.tipo === 'Interno')
  const receita = data.reduce((a, b) => a + b.valor, 0)
  const receitaExterno = externo?.valor ?? 0
  const pctExterno = receita > 0 ? ((receitaExterno / receita) * 100).toFixed(0) : '0'

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              dataKey="qtd"
              startAngle={90}
              endAngle={-270}
              strokeWidth={4}
              stroke="#0A0F22"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#0A0F22',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10,
                padding: '10px 14px',
              }}
              itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9AA3BD' }}
              formatter={(value: number, name: string) => [`${value} OSs`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[28px] font-bold bg-grad bg-clip-text text-transparent leading-none">
            {total}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[1px] text-[var(--text-3)]">
            Total OSs
          </span>
        </div>
      </div>

      <div className="mt-3.5 divide-y divide-[var(--line)]">
        {externo && (
          <div
            onClick={() => drill('tipo', 'Externo')}
            title="Filtrar o painel por atendimento externo"
            className={`-mx-2 flex cursor-pointer items-center justify-between rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-white/[0.02] ${
              activeTipo === 'Externo' ? 'bg-[rgba(0,212,255,0.07)]' : ''
            }`}
          >
            <div>
              <span
                className="mr-2.5 inline-block h-2.5 w-2.5 rounded-[3px] align-middle"
                style={{ background: 'linear-gradient(135deg,#00D4FF,#1E6BFF)' }}
              />
              <strong>Externo</strong>
              <div className="ml-5 mt-0.5 text-[11px] text-[var(--text-3)]">
                {externo.qtd} OSs · ticket{' '}
                {externo.qtd > 0 ? fmtBRL(externo.valor / externo.qtd) : '—'}
              </div>
            </div>
            <span className="font-mono text-[12px] font-semibold text-[var(--cyan)]">
              {fmtBRL(externo.valor)}
            </span>
          </div>
        )}
        {interno && (
          <div
            onClick={() => drill('tipo', 'Interno')}
            title="Filtrar o painel por atendimento interno"
            className={`-mx-2 flex cursor-pointer items-center justify-between rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-white/[0.02] ${
              activeTipo === 'Interno' ? 'bg-[rgba(0,212,255,0.07)]' : ''
            }`}
          >
            <div>
              <span className="mr-2.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-white/20 align-middle" />
              <strong>Interno</strong>
              <div className="ml-5 mt-0.5 text-[11px] text-[var(--text-3)]">
                {interno.qtd} OSs · ticket{' '}
                {interno.qtd > 0 ? fmtBRL(interno.valor / interno.qtd) : '—'}
              </div>
            </div>
            <span className="font-mono text-[12px] font-semibold text-[var(--text)]">
              {fmtBRL(interno.valor)}
            </span>
          </div>
        )}
      </div>

      {Number(pctExterno) > 60 && (
        <div
          className="mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-[12px] leading-relaxed text-[var(--text-2)]"
          style={{
            background: 'linear-gradient(135deg, rgba(46,230,168,0.06), rgba(46,230,168,0.02))',
            borderColor: 'rgba(46,230,168,0.15)',
          }}
        >
          <span className="font-bold text-[var(--green)]">▲</span>
          <div>
            <strong className="text-[var(--text)]">
              Atendimento Externo gera {pctExterno}%
            </strong>{' '}
            da receita — oportunidade de priorização.
          </div>
        </div>
      )}
    </div>
  )
}
