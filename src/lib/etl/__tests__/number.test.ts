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

  // Regressão do bug de produção (Julho/2026): o SheetJS com raw:false formata
  // números em locale US, então o valor chegava como string "24,100.10" ou
  // "24100.10" e era inflado ×100 → fechamento em R$ 2.410.010,00.
  it('formato US com milhar: "24,100.10" → 24100.10 (não infla)', () => {
    expect(parseBrNumber('24,100.10')).toBeCloseTo(24100.1, 2)
    expect(parseBrNumber('4,688.83')).toBeCloseTo(4688.83, 2)
  })

  it('formato US só decimal: "24100.10" → 24100.10 (não vira 2410010)', () => {
    expect(parseBrNumber('24100.10')).toBeCloseTo(24100.1, 2)
    expect(parseBrNumber('1500.00')).toBeCloseTo(1500, 2)
    expect(parseBrNumber('1500.50')).toBeCloseTo(1500.5, 2)
  })

  it('símbolo de moeda e espaços são ignorados', () => {
    expect(parseBrNumber('R$ 4.688,83')).toBeCloseTo(4688.83, 2)
    expect(parseBrNumber('R$ 24,100.10')).toBeCloseTo(24100.1, 2)
  })

  it('milhar de múltiplos grupos: "12.345.678" → 12345678', () => {
    expect(parseBrNumber('12.345.678')).toBe(12345678)
    expect(parseBrNumber('1.234.567,89')).toBeCloseTo(1234567.89, 2)
  })

  it('vazio, traço, nulo → 0', () => {
    expect(parseBrNumber('')).toBe(0)
    expect(parseBrNumber('-')).toBe(0)
    expect(parseBrNumber(null)).toBe(0)
    expect(parseBrNumber(undefined)).toBe(0)
    expect(parseBrNumber('abc')).toBe(0)
  })
})
