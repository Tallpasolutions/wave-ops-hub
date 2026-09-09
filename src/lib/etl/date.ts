// Parse das colunas de data da planilha (Data, Inicio), robusto ao formato de exibição.
//
// Contexto do bug de produção (Setembro/2026): o parser lê o xlsx com `raw: false`
// (parser.ts), então uma célula de data NÃO chega como Date — chega como a string já
// formatada pelo SheetJS, seguindo o formato de exibição gravado no arquivo. Até
// agosto a Unetvale exportava com formato US ("7/1/26 8:35") e `new Date(str)`, que
// interpreta MM/DD, acertava por coincidência. A exportação de setembro passou a vir
// com formato BR ("01/09/2026 07:49") e a mesma interpretação MM/DD quebrou de dois
// jeitos, ambos silenciosos:
//   - dia > 12 ("31/08/2026") → Invalid Date → linha rejeitada
//   - dia <= 12 ("01/09/2026") → 9 de JANEIRO, mês e dia trocados
//
// A correção real está no parser: para as colunas de data usamos o valor CRU da célula
// (um Date, sem ambiguidade de locale) em vez da string formatada. Este módulo cobre os
// dois caminhos e é o único ponto que interpreta data no ETL.
//
// Segundos e milissegundos são zerados: a string formatada nunca os trouxe, e
// `data_execucao` faz parte da chave natural da visita (tenant_id, os_num,
// data_execucao, tecnico_id). Preservá-los faria um re-upload de planilha antiga gerar
// uma chave diferente da já gravada e duplicar a visita.

const BR_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

// Serial do Excel: dias desde 1899-12-30 (o "bug do ano 1900" já embutido).
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

function truncate(d: Date): Date | null {
  if (isNaN(d.getTime())) return null
  d.setSeconds(0, 0)
  return d
}

export function parseSheetDate(value: unknown): Date | null {
  if (value instanceof Date) return truncate(new Date(value.getTime()))

  // Célula numérica sem formato de data: o SheetJS não a converte em Date e
  // `new Date(46266)` daria 1970 sem nenhum erro visível.
  if (typeof value === 'number') {
    if (!isFinite(value) || value <= 0) return null
    return truncate(new Date(EXCEL_EPOCH_UTC + Math.round(value * MS_PER_DAY)))
  }

  if (typeof value !== 'string') return null
  const s = value.trim()
  if (s === '') return null

  const br = BR_DATE.exec(s)
  if (br) {
    const [, dia, mes, ano, hora, min, seg] = br
    // Construção em horário local, igual ao Date que o SheetJS produz para a célula.
    const d = new Date(
      Number(ano),
      Number(mes) - 1,
      Number(dia),
      Number(hora ?? 0),
      Number(min ?? 0),
      Number(seg ?? 0),
    )
    // Rejeita data impossível ("31/02/2026" viraria 03/03 no rollover do JS).
    if (d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) return null
    return truncate(d)
  }

  if (ISO_DATE.test(s)) return truncate(new Date(s))

  return null
}
