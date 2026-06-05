import type { FinalidadeRow } from '../_lib/aggregate'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  rows: FinalidadeRow[]
  totalVisitas: number
}

export function OsTypeTable({ rows, totalVisitas }: Props) {
  const max = Math.max(...rows.map((r) => r.qtd), 1)

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Tipo de OS
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Qtd
          </th>
          <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Distribuição
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Ticket Médio
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Valor Total
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Finalização
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const dist = totalVisitas > 0 ? (row.qtd / totalVisitas) * 100 : 0
          const taxaColor =
            row.taxa >= 75
              ? 'text-[var(--green)]'
              : row.taxa >= 60
                ? 'text-[var(--cyan)]'
                : 'text-[var(--amber)]'

          return (
            <tr key={row.nome} className="group">
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-[13px] group-last:border-0 group-hover:bg-white/[0.015]">
                <span
                  className={`mr-2.5 inline-block h-[22px] w-[22px] rounded-[6px] text-center font-mono text-[10px] font-bold leading-[22px] ${
                    i < 3
                      ? 'bg-grad text-[#051127]'
                      : 'bg-white/5 text-[var(--text-2)]'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <strong>{row.nome}</strong>
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium group-last:border-0 group-hover:bg-white/[0.015]">
                {row.qtd}
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 group-last:border-0 group-hover:bg-white/[0.015]">
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-grad"
                      style={{ width: `${(row.qtd / max) * 100}%` }}
                    />
                  </div>
                  <span className="min-w-[36px] text-right font-mono text-[11px] text-[var(--text-2)]">
                    {dist.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium group-last:border-0 group-hover:bg-white/[0.015]">
                {fmtBRL(row.valorMedio)}
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium text-[var(--cyan)] group-last:border-0 group-hover:bg-white/[0.015]">
                {fmtBRL(row.valorTotal)}
              </td>
              <td
                className={`border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium group-last:border-0 group-hover:bg-white/[0.015] ${taxaColor}`}
              >
                {row.taxa.toFixed(1)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
