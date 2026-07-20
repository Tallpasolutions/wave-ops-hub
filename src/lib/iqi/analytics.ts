// Agregações puras sobre snapshots de IQI, compartilhadas entre a tela gerencial
// e o app do técnico. Sem I/O — recebe linhas já lidas do banco.

/** Linha mínima de snapshot que as agregações consomem (camelCase). */
export interface IqiSnapshotInput {
  tecnicoId: string
  competencia: string // "AAAA-MM"
  totalOs: number
  contratosReincidentes: number
  pctReincidencia: number
}

/** Ponto mensal da tendência (nível equipe ou técnico). */
export interface IqiTrendPoint {
  competencia: string
  label: string // "jul/26"
  totalOs: number
  contratosReincidentes: number
  pctReincidencia: number
}

const MES_ABREV = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** "2026-07" → "jul/26". Retorna a própria string se o formato não casar. */
export function competenciaLabel(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!m) return competencia
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return competencia
  return `${MES_ABREV[mes - 1]}/${m[1].slice(2)}`
}

function pct(reincidentes: number, total: number): number {
  return total > 0 ? Math.round((reincidentes / total) * 10000) / 100 : 0
}

/**
 * Tendência mensal agregando todos os técnicos das linhas recebidas.
 * O IQI da equipe no mês = soma(reincidentes) / soma(totalOs) — não a média
 * dos percentuais (que distorceria por técnicos com poucos OS).
 */
export function buildIqiTrend(rows: IqiSnapshotInput[]): IqiTrendPoint[] {
  const byComp = new Map<string, { totalOs: number; reincidentes: number }>()
  for (const r of rows) {
    const cur = byComp.get(r.competencia) ?? { totalOs: 0, reincidentes: 0 }
    cur.totalOs += r.totalOs
    cur.reincidentes += r.contratosReincidentes
    byComp.set(r.competencia, cur)
  }
  return [...byComp.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([competencia, v]) => ({
      competencia,
      label: competenciaLabel(competencia),
      totalOs: v.totalOs,
      contratosReincidentes: v.reincidentes,
      pctReincidencia: pct(v.reincidentes, v.totalOs),
    }))
}

/** Mapa tecnicoId → snapshot de uma competência específica. */
export function iqiByTecnico(
  rows: IqiSnapshotInput[],
  competencia: string,
): Map<string, IqiSnapshotInput> {
  const out = new Map<string, IqiSnapshotInput>()
  for (const r of rows) {
    if (r.competencia === competencia) out.set(r.tecnicoId, r)
  }
  return out
}

/** IQI consolidado da equipe numa competência (soma/soma). Null se sem dados. */
export function teamIqi(
  rows: IqiSnapshotInput[],
  competencia: string,
): { totalOs: number; contratosReincidentes: number; pctReincidencia: number } | null {
  const doMes = rows.filter((r) => r.competencia === competencia)
  if (doMes.length === 0) return null
  const totalOs = doMes.reduce((a, r) => a + r.totalOs, 0)
  const reincidentes = doMes.reduce((a, r) => a + r.contratosReincidentes, 0)
  return { totalOs, contratosReincidentes: reincidentes, pctReincidencia: pct(reincidentes, totalOs) }
}
