import type { TecnicoRow } from '../_lib/aggregate'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  rows: TecnicoRow[]
}

export function TechnicianRankingTable({ rows }: Props) {
  const max = Math.max(...rows.map((r) => r.totalOs), 1)

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3 w-[32%]">
            Técnico
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            OSs
          </th>
          <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Carga de trabalho
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Valor Gerado
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Ticket Médio
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Taxa Sucesso
          </th>
          <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)] border-b border-[var(--line)] px-3">
            Improdutivas
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const taxaColor =
            row.taxaSucesso >= 70
              ? 'text-[var(--green)]'
              : row.taxaSucesso >= 60
                ? 'text-[var(--cyan)]'
                : 'text-[var(--amber)]'

          return (
            <tr key={row.id ?? row.nome} className="group">
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
                <strong className="font-semibold">{row.nome}</strong>
                <div className="ml-8 mt-0.5 font-mono text-[11px] text-[var(--text-3)]">
                  {row.finalizadas} finalizadas · {row.naoFinalizadas} não-finalizadas
                </div>
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right text-[14px] font-bold group-last:border-0 group-hover:bg-white/[0.015]">
                {row.totalOs}
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 group-last:border-0 group-hover:bg-white/[0.015]">
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-grad"
                      style={{ width: `${(row.totalOs / max) * 100}%` }}
                    />
                  </div>
                  <span className="min-w-[36px] text-right font-mono text-[11px] text-[var(--text-2)]">
                    {((row.totalOs / rows.reduce((a, b) => a + b.totalOs, 0)) * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-semibold text-[var(--cyan)] group-last:border-0 group-hover:bg-white/[0.015]">
                {fmtBRL(row.valorTotal)}
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium group-last:border-0 group-hover:bg-white/[0.015]">
                {fmtBRL(row.valorMedio)}
              </td>
              <td
                className={`border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium group-last:border-0 group-hover:bg-white/[0.015] ${taxaColor}`}
              >
                {row.taxaSucesso.toFixed(1)}%
              </td>
              <td className="border-b border-[var(--line)] py-[13px] px-3 text-right font-mono text-[13px] font-medium text-[var(--amber)] group-last:border-0 group-hover:bg-white/[0.015]">
                {row.improdutivas}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
