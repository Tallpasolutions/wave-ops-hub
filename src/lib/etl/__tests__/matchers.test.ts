import { describe, it, expect } from 'vitest'
import { matchTechnician, matchReason } from '../matchers'
import type { TechnicianRef, ReasonRef } from '../matchers'

const TECH_LIST: TechnicianRef[] = [
  { id: 'tech-1', nome_completo: 'João Silva' },
  { id: 'tech-2', nome_completo: 'Maria Souza' },
  { id: 'tech-3', nome_completo: 'Douglas Ribeiro' },
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

  it('remove o prefixo "INFRA WAVE - "', () => {
    expect(matchTechnician('INFRA WAVE - Douglas Ribeiro', TECH_LIST)?.id).toBe('tech-3')
    expect(matchTechnician('INFRA WAVE - João Silva', TECH_LIST)?.id).toBe('tech-1')
  })

  it('colapsa espaço interno duplo (nome que exibe idêntico)', () => {
    expect(matchTechnician('Douglas  Ribeiro', TECH_LIST)?.id).toBe('tech-3')
  })

  it('casa NBSP e prefixo combinados', () => {
    expect(matchTechnician('INFRA WAVE - Douglas Ribeiro', TECH_LIST)?.id).toBe('tech-3')
  })
})

describe('matchTechnician com cadastro prefixado', () => {
  it('casa quando o nome_completo tem o prefixo', () => {
    // Técnicos foram cadastrados COM o prefixo (ex: "INFRA WAVE - Joao Revair Dill").
    // O prefixo é removido dos dois lados antes de comparar.
    const listaComPrefixo: TechnicianRef[] = [
      { id: 'p-1', nome_completo: 'INFRA WAVE - Joao Revair Dill' },
      { id: 'p-2', nome_completo: 'WAVE - Maria Souza' },
    ]
    expect(matchTechnician('INFRA WAVE - Joao Revair Dill', listaComPrefixo)?.id).toBe('p-1')
    expect(matchTechnician('Joao Revair Dill', listaComPrefixo)?.id).toBe('p-1')
    expect(matchTechnician('INFRA WAVE - Maria Souza', listaComPrefixo)?.id).toBe('p-2')
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
