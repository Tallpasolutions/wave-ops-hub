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

export function buildFinancialPoints(
  closings: Array<{
    periodo: string
    total_receita_unetvale: string | null
    total_a_pagar: string | null
    margem: string | null
  }>,
): FinancialPoint[] {
  return closings
    .map((c) => {
      const [yearStr, monthStr] = c.periodo.split('-')
      const d = new Date(Number(yearStr), Number(monthStr) - 1, 1)
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      const receita = Number(c.total_receita_unetvale ?? 0)
      const pago = Number(c.total_a_pagar ?? 0)
      const margem = Number(c.margem ?? 0)
      const margemPct = receita > 0 ? Math.round((margem / receita) * 100) : 0
      return { periodo: c.periodo, label, receita, pago, margem, margemPct }
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
}
