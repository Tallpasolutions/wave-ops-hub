import { describe, expect, it } from 'vitest'
import { isValidMes, generateMonthRange, buildPeriodOptions } from '../period'

describe('isValidMes', () => {
  it('aceita YYYY-MM válido', () => {
    expect(isValidMes('2026-06')).toBe(true)
    expect(isValidMes('2026-01')).toBe(true)
  })
  it('rejeita formatos inválidos', () => {
    expect(isValidMes('2026-6')).toBe(false)
    expect(isValidMes('2026/06')).toBe(false)
    expect(isValidMes('junho')).toBe(false)
    expect(isValidMes(undefined)).toBe(false)
    expect(isValidMes(null)).toBe(false)
  })
})

describe('generateMonthRange', () => {
  it('gera do mais recente ao mais antigo, inclusivo', () => {
    expect(generateMonthRange('2026-04', '2026-06')).toEqual(['2026-06', '2026-05', '2026-04'])
  })
  it('atravessa a virada de ano', () => {
    expect(generateMonthRange('2025-11', '2026-01')).toEqual(['2026-01', '2025-12', '2025-11'])
  })
  it('um único mês', () => {
    expect(generateMonthRange('2026-06', '2026-06')).toEqual(['2026-06'])
  })
  it('respeita o limite de 12 meses', () => {
    const r = generateMonthRange('2020-01', '2026-06')
    expect(r.length).toBe(12)
    expect(r[0]).toBe('2026-06')
  })
  it('entradas inválidas → vazio', () => {
    expect(generateMonthRange('bad', '2026-06')).toEqual([])
  })
})

describe('buildPeriodOptions', () => {
  it('usa os períodos reais quando fornecidos', () => {
    const opts = buildPeriodOptions(['2026-06', '2026-05'])
    expect(opts.map((o) => o.value)).toEqual(['2026-06', '2026-05'])
    expect(opts[0].label).toMatch(/2026/)
  })
  it('sem períodos → fallback de 6 meses', () => {
    expect(buildPeriodOptions()).toHaveLength(6)
    expect(buildPeriodOptions([])).toHaveLength(6)
  })
})
