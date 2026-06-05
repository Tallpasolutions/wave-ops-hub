export type PeriodMes = { label: string; value: string }

export function parsePeriod(mes: string | undefined): { start: string; end: string; label: string } {
  const now = new Date()
  let year: number
  let month: number

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

export function buildPeriodOptions(): PeriodMes[] {
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
