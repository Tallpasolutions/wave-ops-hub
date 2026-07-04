import type { ReactNode } from 'react'
import type { DashboardAgg } from '../_lib/aggregate'

const fmtBRLk = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(1)} mil` : `R$ ${n.toFixed(0)}`

interface Props {
  agg: DashboardAgg
  periodLabel: string
}

export function ExecutiveSummary({ agg, periodLabel }: Props) {
  const { kpis, porCidade, porTecnico, porFinalidade } = agg

  const topCidade = porCidade[0]
  const topCidadePct =
    kpis.totalVisitas > 0
      ? ((topCidade?.qtd ?? 0) / kpis.totalVisitas) * 100
      : 0

  const topFinalidade = porFinalidade[0]
  const topFinalidadePct =
    kpis.totalVisitas > 0
      ? ((topFinalidade?.qtd ?? 0) / kpis.totalVisitas) * 100
      : 0

  const top4Volume = porTecnico.slice(0, 4).reduce((a, b) => a + b.totalOs, 0)
  const top4Pct =
    kpis.totalVisitas > 0 ? ((top4Volume / kpis.totalVisitas) * 100).toFixed(0) : '0'

  // Cada item é condicional; a numeração (01, 02, …) vem da posição APÓS o filtro —
  // nunca do índice na fonte — senão itens ocultos deixam buracos na sequência (QA S2).
  const highlights: ReactNode[] = [
    (
      <>
        <strong style={{ color: '#fff' }}>
          {fmtBRLk(kpis.totalArrecadacao)} arrecadados
        </strong>{' '}
        em {kpis.totalVisitas} OSs no período de{' '}
        <strong style={{ color: '#fff' }}>{periodLabel}</strong>.
      </>
    ),
    topCidade && (
      <>
        <strong style={{ color: '#fff' }}>
          {topCidade.nome} concentra {topCidadePct.toFixed(0)}% do volume
        </strong>{' '}
        e {fmtBRLk(topCidade.valor)} em receita — cidade mais estratégica.
      </>
    ),
    porTecnico.length >= 4 && (
      <>
        <strong style={{ color: '#fff' }}>
          Top 4 técnicos respondem por {top4Pct}%
        </strong>{' '}
        do volume — distribuição que pode ser otimizada.
      </>
    ),
    topFinalidade && (
      <>
        <strong style={{ color: '#fff' }}>
          {topFinalidade.nome} é {topFinalidadePct.toFixed(0)}% das OSs
        </strong>
        {porFinalidade[1] && (
          <>
            , mas{' '}
            <strong style={{ color: '#fff' }}>{porFinalidade[1].nome}</strong> tem o maior
            ticket médio ({fmtBRLk(porFinalidade[1].valorMedio)}).
          </>
        )}
      </>
    ),
  ].filter(Boolean)

  return (
    <ul className="mt-1.5 flex flex-col gap-3.5 list-none p-0">
      {highlights.map((text, i) => (
        <li key={i} className="flex gap-2.5 text-[12.5px] leading-[1.55] text-[var(--text-2)]">
          <span className="font-display font-extrabold text-[var(--cyan)]">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
