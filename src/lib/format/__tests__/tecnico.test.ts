import { describe, expect, it } from 'vitest'
import { stripWavePrefix, tecnicoDisplayName, tecnicoGroupKey } from '../tecnico'

describe('tecnicoDisplayName', () => {
  it('prioriza o nome cadastrado', () => {
    expect(tecnicoDisplayName('Eduardo Ribeiro de Souza', 'WAVE - Eduardo Ribeiro de Souza')).toBe(
      'Eduardo Ribeiro de Souza',
    )
  })

  it('sem vínculo, mostra o nome bruto da planilha sem o prefixo WAVE', () => {
    expect(tecnicoDisplayName(null, 'WAVE - Douglas Ribeiro')).toBe('Douglas Ribeiro (não vinculado)')
    expect(tecnicoDisplayName(null, 'Daniel Orlando Soares')).toBe('Daniel Orlando Soares (não vinculado)')
  })

  it('sem nome nenhum, cai em "Sem técnico"', () => {
    expect(tecnicoDisplayName(null, null)).toBe('Sem técnico')
    expect(tecnicoDisplayName(null, '   ')).toBe('Sem técnico')
    expect(tecnicoDisplayName(undefined)).toBe('Sem técnico')
  })
})

describe('tecnicoGroupKey', () => {
  it('vinculado agrupa pelo id', () => {
    expect(tecnicoGroupKey('uuid-1', 'WAVE - Fulano')).toBe('uuid-1')
  })

  it('não vinculado agrupa pelo nome bruto normalizado (não num balde único)', () => {
    expect(tecnicoGroupKey(null, 'WAVE - Douglas Ribeiro')).toBe('raw:douglas ribeiro')
    expect(tecnicoGroupKey(null, 'wave - Douglas Ribeiro')).toBe('raw:douglas ribeiro')
    expect(tecnicoGroupKey(null, 'WAVE - Daniel Orlando')).not.toBe(
      tecnicoGroupKey(null, 'WAVE - Douglas Ribeiro'),
    )
  })

  it('sem nome bruto cai no balde residual', () => {
    expect(tecnicoGroupKey(null, null)).toBe('__sem_tecnico__')
  })
})

describe('stripWavePrefix', () => {
  it('remove o prefixo WAVE com variações de espaçamento e caixa', () => {
    expect(stripWavePrefix('WAVE - Douglas')).toBe('Douglas')
    expect(stripWavePrefix('wave-Douglas')).toBe('Douglas')
    expect(stripWavePrefix('Douglas')).toBe('Douglas')
  })
})
