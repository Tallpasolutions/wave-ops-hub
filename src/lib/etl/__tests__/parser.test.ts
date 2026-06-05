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
