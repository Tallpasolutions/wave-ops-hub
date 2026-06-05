import { describe, it, expect } from 'vitest'
import { matchTechnician, matchReason } from '../matchers'
import type { TechnicianRef, ReasonRef } from '../matchers'

const TECH_LIST: TechnicianRef[] = [
  { id: 'tech-1', nome_completo: 'João Silva' },
  { id: 'tech-2', nome_completo: 'Maria Souza' },
]

const REASON_LIST: ReasonRef[] = [
  { id: 'r-1', motivo_original: 'Não - Cliente Ausente' },
  { id: 'r-2', motivo_original: 'Não - Problema na Rede' },
]

describe('matchTechnician', () => {
  it('encontra técnico removendo prefixo WAVE -', () => {
    const result = matchTechnician('WAVE - João Silva', TECH_LIST)
    expect(result?.id).toBe('tech-1')
  })

  it('match é case-insensitive', () => {
    const result = matchTechnician('WAVE - JOÃO SILVA', TECH_LIST)
    expect(result?.id).toBe('tech-1')
  })

  it('funciona sem prefixo WAVE', () => {
    const result = matchTechnician('Maria Souza', TECH_LIST)
    expect(result?.id).toBe('tech-2')
  })

  it('retorna null quando técnico não encontrado', () => {
    expect(matchTechnician('WAVE - Desconhecido', TECH_LIST)).toBeNull()
  })

  it('tolera espaços extras ao redor do prefixo', () => {
    const result = matchTechnician('WAVE -  João Silva', TECH_LIST)
    expect(result?.id).toBe('tech-1')
  })
})

describe('matchReason', () => {
  it('retorna null quando sucesso começa com Sim', () => {
    expect(matchReason('Sim', REASON_LIST)).toBeNull()
    expect(matchReason('Sim - Concluído', REASON_LIST)).toBeNull()
    expect(matchReason('SIM', REASON_LIST)).toBeNull()
  })

  it('encontra reason por match exato', () => {
    const result = matchReason('Não - Cliente Ausente', REASON_LIST)
    expect(result?.id).toBe('r-1')
  })

  it('trim antes de comparar', () => {
    const result = matchReason('  Não - Cliente Ausente  ', REASON_LIST)
    expect(result?.id).toBe('r-1')
  })

  it('retorna null quando motivo não encontrado na lista', () => {
    expect(matchReason('Não - Motivo Novo', REASON_LIST)).toBeNull()
  })
})
