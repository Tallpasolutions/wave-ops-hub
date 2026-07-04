import { describe, expect, it } from 'vitest'
import { aggregate, type VisitRow } from '../aggregate'

// Sprint 13 Fase B: OS = entidade (os_num), Visita = execução (linha). Uma OS tem N visitas.
// Ticket médio POR OS = receita total ÷ OSs distintas.
function visit(over: Partial<VisitRow>): VisitRow {
  return {
    os_num: 1,
    data_execucao: '2026-06-10',
    tecnico_id: 't1',
    tecnico_raw: null,
    finalidade: 'Suporte Fibra',
    tipo_atendimento: 'Externo',
    sucesso: 'Sim',
    improdutiva: false,
    rejeitada: false,
    valor_recebido_unetvale: 100,
    cidade: 'Brusque',
    reason_id: null,
    ...over,
  }
}

describe('aggregate — OSs distintas × visitas', () => {
  it('totalOss conta os_num distintos; totalVisitas conta linhas', () => {
    // OS 100 tem 3 visitas, OS 200 tem 1 → 2 OSs, 4 visitas
    const visits = [
      visit({ os_num: 100, valor_recebido_unetvale: 0 }),
      visit({ os_num: 100, valor_recebido_unetvale: 0 }),
      visit({ os_num: 100, valor_recebido_unetvale: 150 }),
      visit({ os_num: 200, valor_recebido_unetvale: 150 }),
    ]
    const { kpis } = aggregate(visits, [], [], 30)
    expect(kpis.totalOss).toBe(2)
    expect(kpis.totalVisitas).toBe(4)
  })

  it('ticket médio = receita total ÷ OSs distintas (não ÷ visitas)', () => {
    const visits = [
      visit({ os_num: 100, valor_recebido_unetvale: 100 }),
      visit({ os_num: 100, valor_recebido_unetvale: 200 }),
      visit({ os_num: 200, valor_recebido_unetvale: 300 }),
    ]
    const { kpis } = aggregate(visits, [], [], 30)
    // receita 600 ÷ 2 OSs = 300 (não 600÷3=200)
    expect(kpis.totalArrecadacao).toBe(600)
    expect(kpis.ticketMedio).toBe(300)
  })

  it('sem visitas → zeros sem divisão por zero', () => {
    const { kpis } = aggregate([], [], [], 30)
    expect(kpis.totalOss).toBe(0)
    expect(kpis.ticketMedio).toBe(0)
  })
})
