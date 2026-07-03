import { describe, expect, it } from 'vitest'
import { aggregateTotals, buildRealtimeFinancialPoints } from '../queries'

const visit = (
  data_execucao: string,
  receita: number | null,
  payout: { status: string; valor: number } | null,
) => ({
  data_execucao,
  finalidade: null,
  valor_recebido_unetvale: receita !== null ? String(receita) : null,
  payouts: payout
    ? { status: payout.status, valor_calculado: String(payout.valor), valor_override: null }
    : null,
})

describe('aggregateTotals', () => {
  it('soma receita e pago efetivo do período', () => {
    const totals = aggregateTotals([
      visit('2026-06-01', 100, { status: 'pending', valor: 40 }),
      visit('2026-06-02', 50, { status: 'approved', valor: 10 }),
    ])
    expect(totals).toEqual({ visitas: 2, receita: 150, pago: 50, margem: 100, margemPct: 67 })
  })

  it('payouts bloqueados (sem regra/pendente/conflito) não contam como pago', () => {
    const totals = aggregateTotals([
      visit('2026-06-01', 100, { status: 'no_rule_match', valor: 999 }),
      visit('2026-06-02', 100, { status: 'pending_classification', valor: 999 }),
      visit('2026-06-03', 100, null),
    ])
    expect(totals.pago).toBe(0)
    expect(totals.receita).toBe(300)
  })

  it('sem visitas retorna zeros sem divisão por zero', () => {
    expect(aggregateTotals([])).toEqual({ visitas: 0, receita: 0, pago: 0, margem: 0, margemPct: 0 })
  })
})

describe('buildRealtimeFinancialPoints', () => {
  it('agrupa visitas por mês e zera meses sem visita (eixo contínuo)', () => {
    const points = buildRealtimeFinancialPoints(
      [
        visit('2026-05-10', 200, { status: 'pending', valor: 50 }),
        visit('2026-05-20', 100, null),
        visit('2026-06-01', 300, { status: 'approved', valor: 100 }),
      ],
      ['2026-04', '2026-05', '2026-06'],
    )
    expect(points.map((p) => p.periodo)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(points[0]).toMatchObject({ receita: 0, pago: 0 })
    expect(points[1]).toMatchObject({ receita: 300, pago: 50, margem: 250 })
    expect(points[2]).toMatchObject({ receita: 300, pago: 100, margem: 200 })
  })

  it('ignora visitas fora dos períodos pedidos', () => {
    const points = buildRealtimeFinancialPoints(
      [visit('2025-12-31', 999, null)],
      ['2026-06'],
    )
    expect(points).toHaveLength(1)
    expect(points[0].receita).toBe(0)
  })
})
