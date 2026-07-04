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

describe('aggregate — volume diário (S3: eixo X sem buracos)', () => {
  it('com periodStart, preenche todos os dias do mês (zeros nos vazios)', () => {
    const visits = [
      visit({ data_execucao: '2026-06-10', valor_recebido_unetvale: 100 }),
      visit({ data_execucao: '2026-06-10', valor_recebido_unetvale: 50 }),
      visit({ data_execucao: '2026-06-12', valor_recebido_unetvale: 30 }),
    ]
    const { volumeDiario } = aggregate(visits, [], [], 30, '2026-06-01')
    // junho tem 30 dias → 30 pontos, sem pular o dia 11 (vazio)
    expect(volumeDiario).toHaveLength(30)
    expect(volumeDiario.map((p) => p.dia)).toContain('11')
    expect(volumeDiario.find((p) => p.dia === '10')).toEqual({ dia: '10', qtd: 2, valor: 150 })
    expect(volumeDiario.find((p) => p.dia === '11')).toEqual({ dia: '11', qtd: 0, valor: 0 })
    expect(volumeDiario.find((p) => p.dia === '12')).toEqual({ dia: '12', qtd: 1, valor: 30 })
  })

  it('sem periodStart, mantém o comportamento antigo (só dias com dados)', () => {
    const visits = [
      visit({ data_execucao: '2026-06-10' }),
      visit({ data_execucao: '2026-06-12' }),
    ]
    const { volumeDiario } = aggregate(visits, [], [], 30)
    expect(volumeDiario.map((p) => p.dia)).toEqual(['10', '12'])
  })
})
