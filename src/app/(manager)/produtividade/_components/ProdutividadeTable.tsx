import { iqiTone } from '@/lib/iqi'

export interface ProdutividadeRow {
  id: string | null
  nome: string
  totalOs: number
  ossPorDia: number
  taxaSucesso: number
  improdutivas: number
  /** IQI (% reincidência) do mês; null quando não há snapshot para o técnico. */
  iqiPct: number | null
}

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Ordena pelo IQI (pior primeiro); técnicos sem IQI vão para o fim.
function sortRows(rows: ProdutividadeRow[]): ProdutividadeRow[] {
  return [...rows].sort((a, b) => {
    if (a.iqiPct === null && b.iqiPct === null) return b.totalOs - a.totalOs
    if (a.iqiPct === null) return 1
    if (b.iqiPct === null) return -1
    return b.iqiPct - a.iqiPct
  })
}

export function ProdutividadeTable({ rows }: { rows: ProdutividadeRow[] }) {
  const sorted = sortRows(rows)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-[var(--line)] text-left text-[10px] font-bold uppercase tracking-[1px] text-[var(--text-3)]">
            <th className="pb-2.5 pr-3 font-bold">Técnico</th>
            <th className="pb-2.5 px-3 text-right font-bold">OSs</th>
            <th className="pb-2.5 px-3 text-right font-bold">OS/dia</th>
            <th className="pb-2.5 px-3 text-right font-bold">Sucesso</th>
            <th className="pb-2.5 px-3 text-right font-bold">Improd.</th>
            <th className="pb-2.5 pl-3 text-right font-bold">IQI</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {sorted.map((r) => {
            const tone = r.iqiPct === null ? null : iqiTone(r.iqiPct)
            return (
              <tr key={r.id ?? r.nome} className="text-[var(--text-2)]">
                <td className="py-2.5 pr-3 font-medium text-[var(--text)]">{r.nome}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">{r.totalOs}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt1(r.ossPorDia)}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {r.taxaSucesso.toFixed(0)}%
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">{r.improdutivas}</td>
                <td className="py-2.5 pl-3 text-right">
                  {r.iqiPct === null ? (
                    <span className="text-[var(--text-3)]">—</span>
                  ) : (
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-[12px] font-bold"
                      style={{ background: tone!.bg, color: tone!.fg }}
                    >
                      {fmt1(r.iqiPct)}%
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
