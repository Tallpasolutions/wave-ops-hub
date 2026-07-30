import { describe, expect, it } from 'vitest'
import { lpuFromEmbed, tabelaAlternativaLabel, tabelaPrecoDetalhe } from '../tabela-preco'

describe('lpuFromEmbed', () => {
  it('aceita objeto', () => {
    expect(lpuFromEmbed({ nome: 'LPU A', ativa: true })).toEqual({ nome: 'LPU A', ativa: true })
  })

  it('aceita array (cardinalidade inferida pelo PostgREST)', () => {
    expect(lpuFromEmbed([{ nome: 'LPU A', ativa: false }])).toEqual({ nome: 'LPU A', ativa: false })
  })

  it('null/undefined/array vazio viram null', () => {
    expect(lpuFromEmbed(null)).toBeNull()
    expect(lpuFromEmbed(undefined)).toBeNull()
    expect(lpuFromEmbed([])).toBeNull()
  })

  it('embed sem nome vira null em vez de objeto quebrado', () => {
    expect(lpuFromEmbed({ ativa: true })).toBeNull()
  })

  it('ativa ausente é tratada como false (não assume padrão)', () => {
    expect(lpuFromEmbed({ nome: 'LPU A' })).toEqual({ nome: 'LPU A', ativa: false })
  })
})

describe('tabelaAlternativaLabel', () => {
  it('tabela padrão não é sinalizada em lista', () => {
    expect(tabelaAlternativaLabel({ nome: 'LPU Wave 2026', ativa: true })).toBeNull()
  })

  it('tabela alternativa é sinalizada pelo nome', () => {
    expect(tabelaAlternativaLabel({ nome: 'SEM AUXILIAR', ativa: false })).toBe('SEM AUXILIAR')
  })

  it('sem LPU não sinaliza', () => {
    expect(tabelaAlternativaLabel(null)).toBeNull()
  })
})

describe('tabelaPrecoDetalhe', () => {
  it('marca a padrão como tal', () => {
    expect(tabelaPrecoDetalhe({ nome: 'LPU Wave 2026', ativa: true })).toBe('LPU Wave 2026 (padrão)')
  })

  it('alternativa aparece só com o nome', () => {
    expect(tabelaPrecoDetalhe({ nome: 'SEM AUXILIAR', ativa: false })).toBe('SEM AUXILIAR')
  })

  it('payout resolvido fora do motor de LPU diz que não veio de tabela', () => {
    expect(tabelaPrecoDetalhe(null)).toBe('Não definida por tabela de preços')
  })
})
