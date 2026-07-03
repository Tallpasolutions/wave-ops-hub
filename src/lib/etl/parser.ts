import * as XLSX from 'xlsx'
import { RawRowSchema } from './schemas'
import { COLUMN_MAP } from './column-mapping'
import { repairMojibake } from './encoding'
import type { RawRow } from './schemas'
import type { IngestError } from './types'

function normalizeKey(key: string): string {
  return key
    .replace(/ /g, ' ') // non-breaking spaces → espaço normal
    .trim()
    .replace(/\?+$/, '')     // trailing "?" (ex: "Sucesso?", "Condominio?")
    .trim()
    .toLowerCase()
}

// Lookup case-insensitive, sem "?" final, sem non-breaking spaces
const NORMALIZED_MAP: Map<string, keyof RawRow> = new Map(
  Object.entries(COLUMN_MAP).map(([k, v]) => [normalizeKey(k), v]),
)

export function parseXlsx(buffer: Buffer): { rows: RawRow[]; errors: IngestError[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Planilha sem abas')

  const sheet = workbook.Sheets[sheetName]
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  })

  if (rawObjects.length === 0) throw new Error('Planilha sem linhas de dados')

  // Mapeia os headers encontrados para os nomes canônicos do schema (case-insensitive).
  // repairMojibake: as planilhas da Unetvale chegam com Latin-1 lido como Mac Roman
  // ("InstalaÁ„o") — reparar aqui garante texto limpo em todo o pipeline (reasons,
  // match de técnico/LPU, visitas). Ver src/lib/etl/encoding.ts.
  const mapped = rawObjects.map((row) => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      const canonical = NORMALIZED_MAP.get(normalizeKey(key))
      if (canonical) result[canonical] = typeof value === 'string' ? repairMojibake(value) : value
    }
    return result
  })

  // Valida se o mapeamento funcionou — mostra colunas encontradas para diagnóstico
  const firstRaw = rawObjects[0] ?? {}
  const foundHeaders = Object.keys(firstRaw).join(', ')
  const firstMapped = mapped[0] ?? {}

  if (!('OS' in firstMapped) || !('Data' in firstMapped)) {
    throw new Error(
      `Colunas obrigatórias não encontradas (OS, Data). Colunas detectadas na planilha: ${foundHeaders}`,
    )
  }

  const REQUIRED: Array<keyof RawRow> = ['Sucesso', 'Finalidade', 'Cidade', 'Valor', 'Tecnico']
  const missing = REQUIRED.filter((f) => !(f in firstMapped))
  if (missing.length > 0) {
    throw new Error(
      `Colunas obrigatórias ausentes: ${missing.join(', ')}. Colunas detectadas na planilha: ${foundHeaders}`,
    )
  }

  const rows: RawRow[] = []
  const errors: IngestError[] = []

  for (let i = 0; i < mapped.length; i++) {
    const parsed = RawRowSchema.safeParse(mapped[i])
    if (parsed.success) {
      rows.push(parsed.data)
    } else {
      errors.push({
        row: i + 2, // +2: compensa header (linha 1) e index base-0
        message: parsed.error.issues
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; '),
      })
    }
  }

  return { rows, errors }
}
