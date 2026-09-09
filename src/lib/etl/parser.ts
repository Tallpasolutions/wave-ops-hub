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

const DATE_FIELDS = new Set<keyof RawRow>(['Data', 'Inicio'])

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

  // Segunda leitura sem formatação: `raw: false` entrega toda célula como a string já
  // formatada pelo SheetJS, e para uma célula de data essa string segue o formato de
  // exibição do arquivo — "7/1/26 8:35" (US, exportações até agosto/2026) ou
  // "01/09/2026 07:49" (BR, a partir de setembro). Interpretar essa string é ambíguo e
  // quebrou o upload de setembro. Aqui pegamos o Date cru da célula, que é o mesmo
  // instante nos dois casos. Mesmas opções ⇒ mesma ordem e quantidade de linhas.
  const rawCells = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  })

  if (rawObjects.length === 0) throw new Error('Planilha sem linhas de dados')

  // Mapeia os headers encontrados para os nomes canônicos do schema (case-insensitive).
  // repairMojibake: as planilhas da Unetvale chegam com Latin-1 lido como Mac Roman
  // ("InstalaÁ„o") — reparar aqui garante texto limpo em todo o pipeline (reasons,
  // match de técnico/LPU, visitas). Ver src/lib/etl/encoding.ts.
  const mapped = rawObjects.map((row, i) => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      const canonical = NORMALIZED_MAP.get(normalizeKey(key))
      if (!canonical) continue
      const cru = rawCells[i]?.[key]
      if (DATE_FIELDS.has(canonical) && cru instanceof Date) {
        result[canonical] = cru
        continue
      }
      result[canonical] = typeof value === 'string' ? repairMojibake(value) : value
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
    // Exportação truncada da Unetvale (setembro/2026): a planilha vem com milhares de
    // linhas em que só Data e Inicio estão preenchidas e todo o resto é nulo. Sem esta
    // checagem cada uma vira quatro erros de tipo do Zod, enterrando os erros reais.
    if (isLinhaSemDados(mapped[i])) {
      errors.push({
        row: i + 2,
        message:
          'linha sem dados da OS — a exportação da planilha veio incompleta (só Data e Início preenchidos)',
      })
      continue
    }

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

// Linha que não traz nenhum dos campos que identificam a OS. Ver o uso em parseXlsx.
function isLinhaSemDados(row: Record<string, unknown> | undefined): boolean {
  if (!row) return true
  const essenciais: Array<keyof RawRow> = ['OS', 'Finalidade', 'Sucesso', 'Tecnico']
  return essenciais.every((campo) => {
    const v = row[campo]
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
  })
}
