import type { MotivoRow } from '../_lib/aggregate'

interface Props {
  rows: MotivoRow[]
}

const CAT_COLORS: Record<string, string> = {
  falha_tecnico: 'text-[var(--red)] bg-[rgba(255,84,112,0.10)]',
  falha_cliente: 'text-[var(--amber)] bg-[rgba(255,181,71,0.10)]',
  forca_maior: 'text-[var(--text-2)] bg-white/10',
  falha_sistema: 'text-[var(--cyan)] bg-[rgba(0,212,255,0.10)]',
  pendente_classificacao: 'text-[var(--text-3)] bg-white/5',
}

export function ReasonsFailure({ rows }: Props) {
  const max = Math.max(...rows.map((r) => r.qtd), 1)
  const total = rows.reduce((a, b) => a + b.qtd, 0)
  const topMotivo = rows[0]

  return (
    <div>
      <div className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.nome}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--line)] py-[11px] last:border-0"
          >
            <div>
              <span className="text-[13px] font-medium">{row.nome}</span>
              <div className="col-span-2 mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,84,112,0.08)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.qtd / max) * 100}%`,
                    background: 'linear-gradient(90deg, #FF5470, #FF8A47)',
                  }}
                />
              </div>
            </div>
            <span
              className={`rounded-[6px] px-2.5 py-1 font-mono text-[12px] font-bold ${CAT_COLORS[row.categoria] ?? CAT_COLORS.pendente_classificacao}`}
            >
              {row.qtd}
            </span>
          </div>
        ))}
      </div>

      {topMotivo && total > 0 && (
        <div
          className="mt-4 flex items-start gap-3 rounded-xl border p-3.5 text-[12px] leading-relaxed text-[var(--text-2)]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,84,112,0.06), rgba(255,84,112,0.02))',
            borderColor: 'rgba(255,84,112,0.15)',
          }}
        >
          <span className="font-bold text-[var(--red)]">●</span>
          <div>
            <strong className="text-[var(--text)]">
              {((topMotivo.qtd / total) * 100).toFixed(0)}% das não-conclusões são &ldquo;
              {topMotivo.nome}&rdquo;
            </strong>{' '}
            — principal causa operacional do período.
          </div>
        </div>
      )}
    </div>
  )
}
