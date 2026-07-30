import { describe, expect, it } from 'vitest'
import { formatConditions, formatPayout } from '../format'
import type { PayoutNarrowed } from '../types'

// Intl.NumberFormat('pt-BR') separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0).
// Na tela é idêntico a um espaço comum; nos asserts, não. Normalizar mantém os literais
// abaixo legíveis sem esconder o texto real que a tela recebe.
const n = (s: string) => s.replace(/ /g, ' ')
const nc = (cs: { campo: string; valor: string }[]) =>
  cs.map((c) => ({ campo: c.campo, valor: n(c.valor) }))

describe('formatPayout', () => {
  it('valor fixo', () => {
    expect(n(formatPayout({ type: 'fixed', value: 20 }))).toBe('Valor fixo de R$ 20,00')
  })

  it('valor fixo zero é dito como "não paga" (regra de garantia da SEM AUXILIAR)', () => {
    expect(n(formatPayout({ type: 'fixed', value: 0 }))).toBe('Não paga (R$ 0,00)')
  })

  it('fórmula com campo adicional', () => {
    const p: PayoutNarrowed = {
      type: 'formula',
      base: 80,
      additional: { field: 'dropUsado', ratePerUnit: 0.3 },
    }
    expect(n(formatPayout(p))).toBe('R$ 80,00 + R$ 0,30 por unidade de drop usado')
  })

  it('percentual da receita', () => {
    expect(n(formatPayout({ type: 'percentage_of_revenue', percentage: 40 }))).toBe(
      '40% do valor recebido da Unetvale',
    )
  })
})

describe('formatConditions', () => {
  it('traduz o nome do campo e o booleano', () => {
    expect(nc(formatConditions({ condominio: true, garantia: false }))).toEqual([
      { campo: 'Condomínio', valor: 'sim' },
      { campo: 'Garantia', valor: 'não' },
    ])
  })

  it('lista de finalidades vira "A, B ou C"', () => {
    expect(
      nc(formatConditions({ finalidade: ['Suporte Fibra', 'Suporte', 'Suporte Condomínio'] })),
    ).toEqual([{ campo: 'Finalidade', valor: 'Suporte Fibra, Suporte ou Suporte Condomínio' }])
  })

  it('lista de um item não usa "ou"', () => {
    expect(nc(formatConditions({ finalidade: ['Retirada'] }))).toEqual([
      { campo: 'Finalidade', valor: 'Retirada' },
    ])
  })

  it('faixa de receita sai em reais (regra sem troca de drop)', () => {
    expect(nc(formatConditions({ valorRecebidoUnetvale: { min: 40, max: 150 } }))).toEqual([
      { campo: 'Valor recebido da Unetvale', valor: 'entre R$ 40,00 e R$ 150,00' },
    ])
  })

  it('faixa só com mínimo ou só com máximo', () => {
    expect(n(formatConditions({ valorRecebidoUnetvale: { min: 40 } })[0].valor)).toBe(
      'a partir de R$ 40,00',
    )
    expect(n(formatConditions({ dropUsado: { max: 50 } })[0].valor)).toBe('até 50')
  })

  it('campo numérico comum não vira moeda', () => {
    expect(nc(formatConditions({ conectoresUsados: 2 }))).toEqual([
      { campo: 'Conectores usados', valor: '2' },
    ])
  })

  it('preserva a ordem declarada na regra', () => {
    const r = nc(
      formatConditions({
        finalidade: 'Retirada',
        tipoAtendimento: 'Externo',
        subterraneaAereo: 'Aéreo',
      }),
    )
    expect(r.map((c) => c.campo)).toEqual(['Finalidade', 'Tipo de atendimento', 'Rede'])
  })

  it('ignora condição com valor nulo em vez de imprimir "null"', () => {
    const conditions = { finalidade: 'Retirada', cidade: null } as never
    expect(nc(formatConditions(conditions))).toEqual([{ campo: 'Finalidade', valor: 'Retirada' }])
  })

  it('regra real da SEM AUXILIAR sai inteira em português', () => {
    const r = nc(
      formatConditions({
        finalidade: ['Suporte Fibra', 'Suporte'],
        tipoAtendimento: 'Externo',
        subterraneaAereo: 'Aéreo',
        agregada: false,
        valorRecebidoUnetvale: { min: 40, max: 150 },
      }),
    )
    expect(r).toEqual([
      { campo: 'Finalidade', valor: 'Suporte Fibra ou Suporte' },
      { campo: 'Tipo de atendimento', valor: 'Externo' },
      { campo: 'Rede', valor: 'Aéreo' },
      { campo: 'Venda atrelada', valor: 'não' },
      { campo: 'Valor recebido da Unetvale', valor: 'entre R$ 40,00 e R$ 150,00' },
    ])
  })
})
