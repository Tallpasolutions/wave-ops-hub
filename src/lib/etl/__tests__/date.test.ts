import { describe, it, expect } from 'vitest'
import { parseSheetDate } from '../date'

describe('parseSheetDate', () => {
  it('aceita Date da célula e zera segundos', () => {
    const d = parseSheetDate(new Date(2026, 8, 1, 7, 49, 28, 999))
    expect(d).toEqual(new Date(2026, 8, 1, 7, 49, 0, 0))
  })

  it('interpreta string em formato BR como DD/MM (regressão Setembro/2026)', () => {
    expect(parseSheetDate('01/09/2026 08:46:53')).toEqual(new Date(2026, 8, 1, 8, 46))
  })

  it('aceita dia maior que 12, que new Date() rejeitava', () => {
    expect(parseSheetDate('31/08/2026 10:04')).toEqual(new Date(2026, 7, 31, 10, 4))
  })

  it('aceita data BR sem hora', () => {
    expect(parseSheetDate('08/09/2026')).toEqual(new Date(2026, 8, 8, 0, 0))
  })

  it('aceita ISO', () => {
    expect(parseSheetDate('2026-04-01')).toEqual(new Date('2026-04-01'))
  })

  it('converte serial do Excel em vez de cair em 1970', () => {
    // 46266 = 2026-09-01 no calendário do Excel (dias desde 1899-12-30).
    expect(parseSheetDate(46266)?.toISOString().slice(0, 10)).toBe('2026-09-01')
  })

  it('rejeita data impossível em vez de rolar o mês', () => {
    expect(parseSheetDate('31/02/2026')).toBeNull()
  })

  it('rejeita texto que não é data', () => {
    // "##########": coluna estreita salva como texto, o dado se perdeu na exportação.
    expect(parseSheetDate('##########')).toBeNull()
    expect(parseSheetDate('')).toBeNull()
    expect(parseSheetDate(null)).toBeNull()
  })
})
