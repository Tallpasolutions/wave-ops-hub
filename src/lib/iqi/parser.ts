import type { IqiMonthly, IqiRawResponse, IqiRawSeries } from './types'

// Nomes das séries no payload da Unetvale. Match tolerante (trim + lower + includes)
// para sobreviver a pequenas variações de rótulo.
const SERIE_TOTAL = 'total de os'
const SERIE_REINCIDENTES = 'contratos com atendimentos'
const SERIE_PCT = 'reincidentes'

function findSerie(
  series: IqiRawSeries[],
  needle: string,
): IqiRawSeries | undefined {
  return series.find((s) => (s.name ?? '').trim().toLowerCase().includes(needle))
}

// "06/2025" → "2025-06". Retorna null se o formato não casar.
function competenciaFromCategory(cat: string): string | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(cat.trim())
  if (!m) return null
  return `${m[2]}-${m[1]}`
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Converte a resposta Highcharts do endpoint IQI em registros mensais normalizados.
 *
 * - Casa as 3 séries por nome (total, reincidentes, %).
 * - Só emite meses com `totalOs > 0` (a Unetvale devolve meses zerados de padding
 *   que não representam atividade real do técnico).
 * - `pctReincidencia` é recalculado a partir das quantidades (não confiamos no
 *   arredondamento da fonte); cai para o valor da série se o total for 0.
 */
export function parseIqiResponse(raw: IqiRawResponse): IqiMonthly[] {
  const categories = raw.xAxis?.categories ?? []
  const series = raw.series ?? []
  if (categories.length === 0 || series.length === 0) return []

  const total = findSerie(series, SERIE_TOTAL)
  const reincidentes = findSerie(series, SERIE_REINCIDENTES)
  const pct = findSerie(series, SERIE_PCT)

  const out: IqiMonthly[] = []

  for (let i = 0; i < categories.length; i++) {
    const competencia = competenciaFromCategory(categories[i])
    if (!competencia) continue

    const totalOs = num(total?.data?.[i])
    if (totalOs <= 0) continue

    const contratosReincidentes = num(reincidentes?.data?.[i])
    const pctReincidencia =
      totalOs > 0
        ? Math.round((contratosReincidentes / totalOs) * 10000) / 100
        : num(pct?.data?.[i])

    out.push({
      competencia,
      totalOs,
      contratosReincidentes,
      pctReincidencia,
      osNums: {
        total: total?.oss?.[i] ?? [],
        reincidentes: reincidentes?.oss?.[i] ?? [],
      },
    })
  }

  return out
}
