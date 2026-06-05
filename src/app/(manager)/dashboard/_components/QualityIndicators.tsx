import type { DashKpis } from '../_lib/aggregate'

interface Props {
  kpis: DashKpis
}

export function QualityIndicators({ kpis }: Props) {
  const indicators = [
    {
      label: 'Taxa de Finalização',
      value: kpis.taxaFinalizacao,
      color: 'var(--green)',
      barClass: 'bg-[var(--green)]',
    },
    {
      label: 'Improdutividade',
      value: kpis.improdutividade,
      color: 'var(--amber)',
      barClass: 'bg-[var(--amber)]',
      barStyle: 'linear-gradient(90deg, #FFB547, #FF8A47)',
    },
    {
      label: 'OSs Rejeitadas',
      value: kpis.totalVisitas > 0 ? (kpis.totalRejeitadas / kpis.totalVisitas) * 100 : 0,
      color: 'var(--red)',
      barStyle: 'linear-gradient(90deg, #FF5470, #FF1F47)',
    },
    {
      label: 'Técnicos Ativos / Equipe',
      value: kpis.equipeAtiva * 10,
      displayValue: `${kpis.equipeAtiva} tec.`,
      color: 'var(--cyan)',
      barClass: 'bg-grad',
    },
  ]

  return (
    <div className="flex flex-col gap-[18px] mt-1.5">
      {indicators.map((ind) => (
        <div key={ind.label}>
          <div className="mb-1.5 flex justify-between text-[12px] text-[var(--text-2)]">
            <span>{ind.label}</span>
            <span className="font-mono font-semibold" style={{ color: ind.color }}>
              {ind.displayValue ?? `${ind.value.toFixed(1)}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${ind.barClass ?? ''}`}
              style={{
                width: `${Math.min(ind.value, 100)}%`,
                background: ind.barStyle,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
