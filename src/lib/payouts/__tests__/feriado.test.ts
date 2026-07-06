import { describe, expect, it } from 'vitest'
import { isDomingoOuFeriado, aplicarAcrescimo } from '../feriado'

// 2026-06-07 é domingo; 2026-06-08 é segunda; 2026-06-06 é sábado.
describe('isDomingoOuFeriado (ADR-011)', () => {
  const feriados = new Set(['2026-06-08', '2026-12-25'])

  it('domingo → true, mesmo sem estar na lista', () => {
    expect(isDomingoOuFeriado('2026-06-07', new Set())).toBe(true)
    expect(isDomingoOuFeriado('2026-06-07T14:30:00+00:00', new Set())).toBe(true)
  })

  it('feriado configurado (dia útil) → true', () => {
    expect(isDomingoOuFeriado('2026-06-08', feriados)).toBe(true) // segunda, mas é feriado
    expect(isDomingoOuFeriado('2026-12-25', feriados)).toBe(true)
  })

  it('dia útil sem ser feriado → false', () => {
    expect(isDomingoOuFeriado('2026-06-08', new Set())).toBe(false) // segunda comum
    expect(isDomingoOuFeriado('2026-06-06', feriados)).toBe(false) // sábado não conta
  })

  it('nulo/vazio → false', () => {
    expect(isDomingoOuFeriado(null, feriados)).toBe(false)
    expect(isDomingoOuFeriado('', feriados)).toBe(false)
  })
})

describe('aplicarAcrescimo', () => {
  it('15% sobre o valor', () => {
    expect(aplicarAcrescimo(100, 15)).toBeCloseTo(115, 2)
    expect(aplicarAcrescimo(44, 15)).toBeCloseTo(50.6, 2)
    expect(aplicarAcrescimo(120, 0)).toBe(120)
  })
})
