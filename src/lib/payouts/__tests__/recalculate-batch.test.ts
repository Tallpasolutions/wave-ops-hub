import { describe, expect, it } from 'vitest'
import { chunkArray, RECALC_CHUNK_SIZE } from '../recalculate-batch'

// O recálculo sem paginação era cortado silenciosamente em 1000 linhas pelo PostgREST
// e estourava o tempo da Server Action (503 — C3 do QA de 02/07/2026). O particionamento
// é a base da correção: cada página fica dentro dos limites de URL e de tempo.
describe('chunkArray', () => {
  it('particiona em pedaços do tamanho pedido', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5], 2)
    expect(chunks).toEqual([[1, 2], [3, 4], [5]])
  })

  it('lista menor que o chunk vira um único pedaço', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]])
  })

  it('lista vazia não gera pedaços', () => {
    expect(chunkArray([], 10)).toEqual([])
  })

  it('preserva todos os elementos e a ordem', () => {
    const items = Array.from({ length: 1013 }, (_, i) => i)
    const chunks = chunkArray(items, RECALC_CHUNK_SIZE)
    expect(chunks.flat()).toEqual(items)
    expect(chunks.every((c, i) => i === chunks.length - 1 || c.length === RECALC_CHUNK_SIZE)).toBe(true)
  })

  it('rejeita tamanho de chunk inválido', () => {
    expect(() => chunkArray([1], 0)).toThrow()
  })

  it('RECALC_CHUNK_SIZE fica abaixo do row-limit do PostgREST (1000)', () => {
    expect(RECALC_CHUNK_SIZE).toBeLessThan(1000)
    expect(RECALC_CHUNK_SIZE).toBeGreaterThan(0)
  })
})
