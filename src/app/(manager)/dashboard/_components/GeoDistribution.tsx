'use client'
import type { CidadeRow } from '../_lib/aggregate'
import { useDrilldown } from '../_lib/useDrilldown'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  rows: CidadeRow[]
}

export function GeoDistribution({ rows }: Props) {
  const max = Math.max(...rows.map((r) => r.qtd), 1)
  const { drill, activeOf } = useDrilldown()
  const active = activeOf('cidade')

  return (
    <div className="divide-y divide-[var(--line)]">
      {rows.map((row, i) => (
        <div
          key={row.nome}
          onClick={() => drill('cidade', row.nome)}
          title="Filtrar o painel por esta cidade"
          className={`-mx-2 cursor-pointer rounded-lg px-2 py-3 transition-colors hover:bg-white/[0.02] ${
            active === row.nome ? 'bg-[rgba(0,212,255,0.07)]' : ''
          }`}
        >
          <div className="grid grid-cols-[1fr_60px_90px] items-center gap-3.5">
            <span className={`text-[13px] font-semibold ${i === 0 ? 'text-[var(--cyan)]' : ''}`}>
              {row.nome}
            </span>
            <span className="text-right font-mono text-[11px] text-[var(--text-2)]">
              {row.qtd} OSs
            </span>
            <span className="text-right font-mono text-[11px] text-[var(--text-2)]">
              {fmtBRL(row.valor)}
            </span>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/[0.04]">
            <div
              className="h-full rounded-full bg-grad"
              style={{ width: `${(row.qtd / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
