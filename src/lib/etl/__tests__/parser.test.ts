import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseXlsx } from '../parser'

type SheetRow = Record<string, unknown>

function makeXlsxBuffer(rows: SheetRow[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
}

// Reproduz uma célula de data real da Unetvale: o valor é um Date e o formato de
// exibição (`z`) decide a string que o SheetJS devolve com raw:false — "01/09/2026 07:49"
// nas exportações de setembro, "9/1/26 7:49" nas anteriores.
function makeXlsxComDatas(datas: Array<{ Data: Date; Inicio: Date }>, formato: string): Buffer {
  const rows = datas.map((d) => ({ ...BASE_ROW, ...d }))
  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true })
  for (let i = 0; i < rows.length; i++) {
    for (const col of ['A', 'B']) {
      const cell = ws[`${col}${i + 2}`] as XLSX.CellObject
      cell.z = formato
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true }) as ArrayBuffer)
}

const BASE_ROW: SheetRow = {
  Data: '2026-04-01',
  Inicio: '2026-04-01',
  OS: 12345,
  Finalidade: 'Instalação',
  'Tipo de atendimento': 'Externo',
  Cidade: 'São Paulo',
  Sucesso: 'Sim',
  Valor: 120,
  Técnico: 'WAVE - João Silva',
}

describe('parseXlsx', () => {
  it('parseia linha válida com headers padrão', () => {
    const buf = makeXlsxBuffer([BASE_ROW])
    const { rows, errors } = parseXlsx(buf)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].OS).toBe(12345)
    expect(rows[0].Tecnico).toBe('WAVE - João Silva')
    expect(rows[0].Sucesso).toBe('Sim')
  })

  it('parseia Valor decimal sem inflar (regressão bug Julho/2026)', () => {
    // 24100.10 escrito como número real na célula: com raw:false o SheetJS o
    // formata em locale US e a versão antiga do parser o inflava ×100.
    const buf = makeXlsxBuffer([{ ...BASE_ROW, Valor: 24100.1 }])
    const { rows, errors } = parseXlsx(buf)
    expect(errors).toHaveLength(0)
    expect(rows[0].Valor).toBeCloseTo(24100.1, 2)
  })

  it('aceita header garbled TÈcnico (encoding latin-1)', () => {
    const buf = makeXlsxBuffer([{ ...BASE_ROW, Técnico: undefined, TÈcnico: 'WAVE - Maria' }])
    const { rows, errors } = parseXlsx(buf)
    expect(errors).toHaveLength(0)
    expect(rows[0].Tecnico).toBe('WAVE - Maria')
  })

  it('aceita múltiplas linhas e retorna todas válidas', () => {
    const rows = [BASE_ROW, { ...BASE_ROW, OS: 99999 }]
    const buf = makeXlsxBuffer(rows)
    const { rows: parsed, errors } = parseXlsx(buf)
    expect(parsed).toHaveLength(2)
    expect(errors).toHaveLength(0)
    expect(parsed[1].OS).toBe(99999)
  })

  it('coleta erros por linha sem parar o processo', () => {
    const rows = [
      BASE_ROW,
      { ...BASE_ROW, OS: 'nao-e-numero', Valor: 'nao-e-numero' }, // linha inválida
      { ...BASE_ROW, OS: 55555 },
    ]
    const buf = makeXlsxBuffer(rows)
    const { rows: parsed, errors } = parseXlsx(buf)
    expect(parsed).toHaveLength(2) // linha 1 e 3
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(3) // linha 2 da planilha = index 1 + 2
  })

  it('lê data de célula formatada em BR sem trocar dia e mês (regressão Setembro/2026)', () => {
    const buf = makeXlsxComDatas(
      [{ Data: new Date(2026, 8, 1, 7, 49), Inicio: new Date(2026, 7, 31, 10, 4) }],
      'dd/mm/yyyy hh:mm',
    )
    const { rows, errors } = parseXlsx(buf)
    expect(errors).toHaveLength(0)
    expect(rows[0].Data).toEqual(new Date(2026, 8, 1, 7, 49))
    // 31/08 estourava o parse MM/DD e rejeitava a linha inteira com "Invalid date".
    expect(rows[0].Inicio).toEqual(new Date(2026, 7, 31, 10, 4))
  })

  it('lê a mesma data de célula formatada em US (planilhas até Agosto/2026)', () => {
    const buf = makeXlsxComDatas(
      [{ Data: new Date(2026, 8, 1, 7, 49), Inicio: new Date(2026, 7, 31, 10, 4) }],
      'm/d/yy h:mm',
    )
    const { rows, errors } = parseXlsx(buf)
    expect(errors).toHaveLength(0)
    expect(rows[0].Data).toEqual(new Date(2026, 8, 1, 7, 49))
    expect(rows[0].Inicio).toEqual(new Date(2026, 7, 31, 10, 4))
  })

  it('reporta um erro único para linha sem dados da OS', () => {
    const buf = makeXlsxBuffer([
      BASE_ROW,
      { Data: '2026-04-02', Inicio: '2026-04-02' }, // exportação truncada
    ])
    const { rows, errors } = parseXlsx(buf)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(3)
    expect(errors[0].message).toContain('exportação da planilha veio incompleta')
  })

  it('lança erro fatal se planilha sem coluna OS ou Data', () => {
    const buf = makeXlsxBuffer([{ ColunaCerta: 'nada', OutraColuna: 123 }])
    expect(() => parseXlsx(buf)).toThrow('Colunas obrigatórias não encontradas')
  })

  it('lança erro fatal se planilha sem linhas', () => {
    const ws = XLSX.utils.json_to_sheet([])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer)
    expect(() => parseXlsx(buf)).toThrow('Planilha sem linhas de dados')
  })
})
