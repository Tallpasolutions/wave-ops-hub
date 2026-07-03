export type FinancialByFinalidade = {
  finalidade: string
  visitas: number
  receita: number
  pago: number
  margem: number
  margemPct: number
}

export type FinancialByTecnico = {
  tecnicoId: string
  tecnicoNome: string
  visitas: number
  receita: number
  pago: number
  margem: number
  margemPct: number
}

export type FinancialPoint = {
  periodo: string
  label: string
  receita: number
  pago: number
  margem: number
  margemPct: number
}

const PAID_STATUSES = new Set(['approved', 'paid', 'override', 'pending_review', 'pending'])

type VisitWithPayout = {
  finalidade: string | null
  valor_recebido_unetvale: string | null
  payouts: {
    status: string
    valor_calculado: string | null
    valor_override: string | null
  } | null
}

type VisitWithTech = VisitWithPayout & {
  technicians: { id: string; nome_completo: string } | null
}

function efetivoPago(payout: VisitWithPayout['payouts']): number {
  if (!payout || !PAID_STATUSES.has(payout.status)) return 0
  const v =
    payout.valor_override !== null
      ? Number(payout.valor_override)
      : Number(payout.valor_calculado ?? 0)
  return isNaN(v) ? 0 : v
}

export function aggregateByFinalidade(visits: VisitWithPayout[]): FinancialByFinalidade[] {
  const map = new Map<string, { visitas: number; receita: number; pago: number }>()

  for (const v of visits) {
    const key = v.finalidade ?? '(sem finalidade)'
    const rec = Number(v.valor_recebido_unetvale ?? 0)
    const pago = efetivoPago(
      v.payouts as unknown as VisitWithPayout['payouts'],
    )

    const existing = map.get(key) ?? { visitas: 0, receita: 0, pago: 0 }
    existing.visitas++
    existing.receita += isNaN(rec) ? 0 : rec
    existing.pago += pago
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([finalidade, { visitas, receita, pago }]) => {
      const margem = receita - pago
      const margemPct = receita > 0 ? Math.round((margem / receita) * 100) : 0
      return { finalidade, visitas, receita, pago, margem, margemPct }
    })
    .sort((a, b) => b.receita - a.receita)
}

export function aggregateByTecnico(visits: VisitWithTech[]): FinancialByTecnico[] {
  const map = new Map<
    string,
    { nome: string; visitas: number; receita: number; pago: number }
  >()

  for (const v of visits) {
    const tech = v.technicians as unknown as { id: string; nome_completo: string } | null
    const key = tech?.id ?? '__sem_tecnico__'
    const nome = tech?.nome_completo ?? 'Sem técnico'
    const rec = Number(v.valor_recebido_unetvale ?? 0)
    const pago = efetivoPago(v.payouts as unknown as VisitWithPayout['payouts'])

    const existing = map.get(key) ?? { nome, visitas: 0, receita: 0, pago: 0 }
    existing.visitas++
    existing.receita += isNaN(rec) ? 0 : rec
    existing.pago += pago
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([tecnicoId, { nome, visitas, receita, pago }]) => {
      const margem = receita - pago
      const margemPct = receita > 0 ? Math.round((margem / receita) * 100) : 0
      return { tecnicoId, tecnicoNome: nome, visitas, receita, pago, margem, margemPct }
    })
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 10)
}

export type FinancialTotals = {
  visitas: number
  receita: number
  pago: number
  margem: number
  margemPct: number
}

type VisitFinancials = Pick<VisitWithPayout, 'valor_recebido_unetvale' | 'payouts'>

// KPIs do período em tempo real — mesma fonte (visitas + payouts) das tabelas por
// finalidade/técnico, eliminando a contradição com os fechamentos não aprovados
// (decisão da Sprint 11 Fase D, 03/07/2026).
export function aggregateTotals(visits: VisitFinancials[]): FinancialTotals {
  let receita = 0
  let pago = 0
  for (const v of visits) {
    const rec = Number(v.valor_recebido_unetvale ?? 0)
    receita += isNaN(rec) ? 0 : rec
    pago += efetivoPago(v.payouts as unknown as VisitWithPayout['payouts'])
  }
  const margem = receita - pago
  const margemPct = receita > 0 ? Math.round((margem / receita) * 100) : 0
  return { visitas: visits.length, receita, pago, margem, margemPct }
}

type VisitWithDate = VisitFinancials & { data_execucao: string }

// Série mensal em tempo real a partir das visitas — inclui todos os `periodos`
// pedidos (meses sem visita entram zerados, mantendo o eixo do gráfico contínuo).
export function buildRealtimeFinancialPoints(
  visits: VisitWithDate[],
  periodos: string[],
): FinancialPoint[] {
  const byPeriodo = new Map<string, VisitWithDate[]>()
  for (const v of visits) {
    const p = v.data_execucao.slice(0, 7)
    const list = byPeriodo.get(p) ?? []
    list.push(v)
    byPeriodo.set(p, list)
  }

  return [...periodos].sort().map((periodo) => {
    const [yearStr, monthStr] = periodo.split('-')
    const d = new Date(Number(yearStr), Number(monthStr) - 1, 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    const totals = aggregateTotals(byPeriodo.get(periodo) ?? [])
    return {
      periodo,
      label,
      receita: totals.receita,
      pago: totals.pago,
      margem: totals.margem,
      margemPct: totals.margemPct,
    }
  })
}
