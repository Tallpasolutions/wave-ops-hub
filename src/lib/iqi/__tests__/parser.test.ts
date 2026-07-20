import { describe, it, expect } from 'vitest'
import { parseIqiResponse } from '../parser'
import type { IqiRawResponse } from '../types'

// Fixture baseada na resposta real do endpoint /index/iqi para o técnico 540
// (Carlos Henrique), coletada em 19/07/2026. Meses zerados de padding incluídos
// de propósito para exercitar o filtro `totalOs > 0`.
const FIXTURE: IqiRawResponse = {
  xAxis: {
    categories: [
      '06/2025', '07/2025', '08/2025', '09/2025', '10/2025', '11/2025',
      '12/2025', '01/2026', '02/2026', '03/2026', '04/2026', '05/2026',
      '06/2026', '07/2026',
    ],
  },
  series: [
    {
      type: 'column',
      name: "Total de OS's",
      data: [0, 0, 30, 41, 23, 32, 30, 34, 25, 28, 14, 0, 0, 0],
      oss: [[], [], [1, 2], [], [], [], [], [], [], [], [], [], [], []],
    },
    {
      type: 'column',
      name: 'Contratos com atendimentos',
      data: [0, 0, 6, 5, 7, 8, 2, 9, 6, 2, 2, 0, 0, 0],
      oss: [[], [], [1], [], [], [], [], [], [], [], [], [], [], []],
    },
    {
      type: 'spline',
      name: '% com atendimentos reincidentes',
      data: [0, 0, 20, 12.2, 30.43, 25, 6.67, 26.47, 24, 7.14, 14.29, 0, 0, 0],
    },
  ],
}

describe('parseIqiResponse', () => {
  it('emite apenas meses com atividade (totalOs > 0)', () => {
    const res = parseIqiResponse(FIXTURE)
    expect(res.map((m) => m.competencia)).toEqual([
      '2025-08', '2025-09', '2025-10', '2025-11',
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
    ])
  })

  it('converte "MM/AAAA" para "AAAA-MM"', () => {
    const res = parseIqiResponse(FIXTURE)
    expect(res[0].competencia).toBe('2025-08')
  })

  it('recalcula o percentual a partir das quantidades', () => {
    const res = parseIqiResponse(FIXTURE)
    const ago = res.find((m) => m.competencia === '2025-08')!
    expect(ago.totalOs).toBe(30)
    expect(ago.contratosReincidentes).toBe(6)
    expect(ago.pctReincidencia).toBe(20)

    const out = res.find((m) => m.competencia === '2025-10')!
    expect(out.pctReincidencia).toBe(30.43) // 7/23 = 30.4347… → 30.43
  })

  it('captura os números de OS para drilldown', () => {
    const res = parseIqiResponse(FIXTURE)
    const ago = res.find((m) => m.competencia === '2025-08')!
    expect(ago.osNums.total).toEqual([1, 2])
    expect(ago.osNums.reincidentes).toEqual([1])
  })

  it('casa séries por nome de forma tolerante (trim/case/variações)', () => {
    const variação: IqiRawResponse = {
      xAxis: { categories: ['08/2025'] },
      series: [
        { name: "  TOTAL DE OS'S  ", data: [10] },
        { name: 'Contratos Com Atendimentos', data: [3] },
        { name: '% com Atendimentos Reincidentes', data: [30] },
      ],
    }
    const res = parseIqiResponse(variação)
    expect(res).toHaveLength(1)
    expect(res[0].pctReincidencia).toBe(30)
  })

  it('devolve vazio para payload sem séries ou categorias', () => {
    expect(parseIqiResponse({})).toEqual([])
    expect(parseIqiResponse({ xAxis: { categories: [] }, series: [] })).toEqual([])
  })
})
