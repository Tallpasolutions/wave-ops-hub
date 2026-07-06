import { describe, expect, it } from 'vitest'
import { parseBrNumber } from '../number'

describe('parseBrNumber (formato brasileiro)', () => {
  it('milhar + decimal: "4.688,83" → 4688.83 (não zera mais)', () => {
    expect(parseBrNumber('4.688,83')).toBeCloseTo(4688.83, 2)
    expect(parseBrNumber('12.345,67')).toBeCloseTo(12345.67, 2)
  })

  it('só decimal: "77,77" → 77.77', () => {
    expect(parseBrNumber('77,77')).toBeCloseTo(77.77, 2)
  })

  it('milhar sem decimal: "1.000" → 1000 (não vira 1)', () => {
    expect(parseBrNumber('1.000')).toBe(1000)
    expect(parseBrNumber('1.000,00')).toBe(1000)
  })

  it('número já numérico passa direto', () => {
    expect(parseBrNumber(77.77)).toBeCloseTo(77.77, 2)
    expect(parseBrNumber(0)).toBe(0)
  })

  it('vazio, traço, nulo → 0', () => {
    expect(parseBrNumber('')).toBe(0)
    expect(parseBrNumber('-')).toBe(0)
    expect(parseBrNumber(null)).toBe(0)
    expect(parseBrNumber(undefined)).toBe(0)
    expect(parseBrNumber('abc')).toBe(0)
  })
})
