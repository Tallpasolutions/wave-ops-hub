import { describe, it, expect } from 'vitest'
import {
  buildIqiTrend,
  iqiByTecnico,
  teamIqi,
  competenciaLabel,
} from '../analytics'
import type { IqiSnapshotInput } from '../analytics'

const ROWS: IqiSnapshotInput[] = [
  { tecnicoId: 'a', competencia: '2026-06', totalOs: 30, contratosReincidentes: 6, pctReincidencia: 20 },
  { tecnicoId: 'b', competencia: '2026-06', totalOs: 10, contratosReincidentes: 1, pctReincidencia: 10 },
  { tecnicoId: 'a', competencia: '2026-07', totalOs: 20, contratosReincidentes: 2, pctReincidencia: 10 },
]

describe('competenciaLabel', () => {
  it('formata "AAAA-MM" para "mmm/aa" sem ponto', () => {
    expect(competenciaLabel('2026-07')).toBe('jul/26')
  })
  it('devolve a entrada se o formato não casar', () => {
    expect(competenciaLabel('lixo')).toBe('lixo')
  })
})

describe('buildIqiTrend', () => {
  it('agrega por competência somando quantidades (não média de %)', () => {
    const trend = buildIqiTrend(ROWS)
    expect(trend.map((t) => t.competencia)).toEqual(['2026-06', '2026-07'])
    const jun = trend[0]
    // (6+1) / (30+10) = 7/40 = 17.5% — não a média de 20% e 10% (=15%)
    expect(jun.totalOs).toBe(40)
    expect(jun.contratosReincidentes).toBe(7)
    expect(jun.pctReincidencia).toBe(17.5)
  })
})

describe('iqiByTecnico', () => {
  it('mapeia técnico → snapshot da competência pedida', () => {
    const map = iqiByTecnico(ROWS, '2026-06')
    expect(map.size).toBe(2)
    expect(map.get('a')?.pctReincidencia).toBe(20)
    expect(map.has('a')).toBe(true)
    expect(iqiByTecnico(ROWS, '2026-07').size).toBe(1)
  })
})

describe('teamIqi', () => {
  it('consolida a equipe na competência', () => {
    expect(teamIqi(ROWS, '2026-06')).toEqual({
      totalOs: 40,
      contratosReincidentes: 7,
      pctReincidencia: 17.5,
    })
  })
  it('retorna null sem dados na competência', () => {
    expect(teamIqi(ROWS, '2020-01')).toBeNull()
  })
})
