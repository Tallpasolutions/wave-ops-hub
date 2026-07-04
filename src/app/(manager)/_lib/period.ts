export type PeriodMes = { label: string; value: string }

// Cookie que persiste o período escolhido entre rotas (client seta, server lê).
export const PERIODO_COOKIE = 'wave_periodo'

export function isValidMes(mes: string | null | undefined): mes is string {
  return typeof mes === 'string' && /^\d{4}-\d{2}$/.test(mes)
}

// Lista de meses 'YYYY-MM' de maxMes até minMes (descendente, mais recente primeiro).
// Limitada a 12 meses para não gerar um seletor gigante.
export function generateMonthRange(minMes: string, maxMes: string, limit = 12): string[] {
  if (!isValidMes(minMes) || !isValidMes(maxMes)) return []
  const [minY, minM] = minMes.split('-').map(Number)
  const [maxY, maxM] = maxMes.split('-').map(Number)
  const out: string[] = []
  let y = maxY
  let m = maxM
  while ((y > minY || (y === minY && m >= minM)) && out.length < limit) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return out
}

export function parsePeriod(mes: string | undefined): { start: string; end: string; label: string } {
  const now = new Date()

  let year: number
  let month: number // 1-12

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    ;[year, month] = mes.split('-').map(Number)
  } else {
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  return { start, end, label }
}

// Constrói opções a partir dos períodos reais do banco (ex: ['2026-04', '2026-03'])
// Se nenhum período for fornecido, cai no fallback dos últimos 6 meses
export function buildPeriodOptions(availablePeriods?: string[]): PeriodMes[] {
  if (availablePeriods && availablePeriods.length > 0) {
    return availablePeriods.map((value) => {
      const [yearStr, monthStr] = value.split('-')
      const d = new Date(Number(yearStr), Number(monthStr) - 1, 1)
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      return { value, label }
    })
  }

  // Fallback: últimos 6 meses (quando ainda não há dados)
  const options: PeriodMes[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}
