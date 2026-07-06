import { describe, expect, it } from 'vitest'
import {
  parseFilters,
  hasFilters,
  toggleFilter,
  removeFilter,
  clearFilters,
} from '../filters'

describe('dashboard filters (ADR-010)', () => {
  it('parseFilters extrai só as dimensões conhecidas, ignora vazios', () => {
    const f = parseFilters({ mes: '2026-06', finalidade: 'Suporte Fibra', cidade: '', tecnico: 'abc' })
    expect(f).toEqual({ finalidade: 'Suporte Fibra', tecnico: 'abc' })
    expect(hasFilters(f)).toBe(true)
    expect(hasFilters({})).toBe(false)
  })

  it('toggleFilter seta o valor e preserva os demais params', () => {
    const sp = new URLSearchParams('mes=2026-06&cidade=Brusque')
    const qs = toggleFilter(sp, 'finalidade', 'Suporte Fibra')
    const result = new URLSearchParams(qs)
    expect(result.get('mes')).toBe('2026-06')
    expect(result.get('cidade')).toBe('Brusque')
    expect(result.get('finalidade')).toBe('Suporte Fibra')
  })

  it('toggleFilter no valor já ativo remove (toggle)', () => {
    const sp = new URLSearchParams('mes=2026-06&finalidade=Suporte Fibra')
    const qs = toggleFilter(sp, 'finalidade', 'Suporte Fibra')
    const result = new URLSearchParams(qs)
    expect(result.has('finalidade')).toBe(false)
    expect(result.get('mes')).toBe('2026-06')
  })

  it('removeFilter tira só a dimensão; clearFilters tira todas mas mantém mes', () => {
    const sp = new URLSearchParams('mes=2026-06&finalidade=X&cidade=Y&tecnico=Z')
    expect(new URLSearchParams(removeFilter(sp, 'cidade')).has('cidade')).toBe(false)

    const cleared = new URLSearchParams(clearFilters(sp))
    expect(cleared.get('mes')).toBe('2026-06')
    expect(cleared.has('finalidade')).toBe(false)
    expect(cleared.has('cidade')).toBe(false)
    expect(cleared.has('tecnico')).toBe(false)
  })
})
