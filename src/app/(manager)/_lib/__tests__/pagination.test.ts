import { describe, expect, it } from 'vitest'
import { paginate, parsePage } from '../pagination'

const items = Array.from({ length: 125 }, (_, i) => i + 1)

describe('parsePage', () => {
  it('normaliza para 1 quando inválido', () => {
    expect(parsePage(undefined, 5)).toBe(1)
    expect(parsePage('0', 5)).toBe(1)
    expect(parsePage('abc', 5)).toBe(1)
    expect(parsePage('-3', 5)).toBe(1)
  })
  it('clampa ao total de páginas', () => {
    expect(parsePage('99', 5)).toBe(5)
    expect(parsePage('3', 5)).toBe(3)
  })
})

describe('paginate', () => {
  it('primeira página de 50', () => {
    const { pageItems, info } = paginate(items, '1')
    expect(pageItems).toHaveLength(50)
    expect(pageItems[0]).toBe(1)
    expect(info).toMatchObject({ page: 1, totalPages: 3, totalItems: 125, from: 1, to: 50 })
  })
  it('última página parcial', () => {
    const { pageItems, info } = paginate(items, '3')
    expect(pageItems).toHaveLength(25)
    expect(info).toMatchObject({ page: 3, from: 101, to: 125 })
  })
  it('página fora do range cai na última', () => {
    const { info } = paginate(items, '9')
    expect(info.page).toBe(3)
  })
  it('lista vazia → 1 página, from/to 0', () => {
    const { pageItems, info } = paginate([], '1')
    expect(pageItems).toEqual([])
    expect(info).toMatchObject({ page: 1, totalPages: 1, totalItems: 0, from: 0, to: 0 })
  })
})
