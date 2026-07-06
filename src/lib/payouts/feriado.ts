// Acréscimo de domingo/feriado (ADR-011). A data da visita usa data_execucao.slice(0,10)
// ("YYYY-MM-DD"), a mesma convenção do aggregate e do período. Dia-da-semana via
// Date.UTC → getUTCDay (determinístico, sem depender do fuso do servidor). Feriado = a data
// está na lista configurada (tenants.config.feriados).

export function isDomingoOuFeriado(
  dataExecucao: string | null | undefined,
  feriados: Set<string>,
): boolean {
  if (!dataExecucao) return false
  const date = dataExecucao.slice(0, 10)
  if (feriados.has(date)) return true

  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return false
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0 // 0 = domingo
}

export function aplicarAcrescimo(valor: number, pct: number): number {
  return valor * (1 + pct / 100)
}
