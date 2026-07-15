// Parse de número monetário vindo da planilha (Unetvale), robusto a locale.
//
// Contexto do bug de produção (Julho/2026): o parser lê o xlsx com `raw: false`
// (parser.ts), então células numéricas NÃO chegam como number — chegam como string
// já formatada pelo SheetJS. E o SheetJS formata em locale US: vírgula = milhar,
// ponto = decimal. Assim o número 24100.10 chega como "24,100.10" (US) ou, sem
// agrupamento de milhar, como "24100.10". A versão antiga assumia que ponto isolado
// era sempre milhar e removia todos os pontos → "24100.10" virava 2410010 (×100),
// inflando o fechamento para R$ 2.410.010,00.
//
// Regra robusta: o separador DECIMAL é sempre o que aparece por ÚLTIMO na string.
// Isso resolve os dois formatos que o pipeline pode receber:
//   - BR "24.100,10"  → vírgula é o último  → decimal = ","  → 24100.10
//   - US "24,100.10"  → ponto é o último    → decimal = "."  → 24100.10
// Quando só há um tipo de separador, aplicamos heurística de agrupamento (grupos de
// exatamente 3 dígitos = milhar), preservando o comportamento pt-BR ("1.000" → 1000).
export function parseBrNumber(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (v === null || v === undefined) return 0

  // Remove símbolo de moeda, espaços (inclui non-breaking space) e mantém só o número.
  let s = String(v).trim().replace(/[R$\s ]/g, '')
  if (s === '' || s === '-') return 0

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos presentes: o último é o decimal; o outro é agrupamento de milhar.
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.') // BR: "24.100,10" → "24100.10"
      : s.replace(/,/g, '') // US: "24,100.10" → "24100.10"
  } else if (lastComma !== -1) {
    // Só vírgula: decimal pt-BR ("77,77"), a menos que sejam grupos de milhar ("1,000").
    s = isThousandGrouping(s, ',') ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot !== -1) {
    // Só ponto: milhar pt-BR ("1.000") vs decimal US ("1500.50").
    s = isThousandGrouping(s, '.') ? s.replace(/\./g, '') : s
  }

  const n = Number(s)
  return isNaN(n) ? 0 : n
}

// Detecta agrupamento de milhar: 1+ separadores, cada grupo à direita com exatamente
// 3 dígitos e o grupo à esquerda com 1 a 3 dígitos. Ex: "1.000", "12.345.678".
function isThousandGrouping(s: string, sep: ',' | '.'): boolean {
  const negative = s.startsWith('-')
  const body = negative ? s.slice(1) : s
  const parts = body.split(sep)
  if (parts.length < 2) return false
  if (!/^[0-9]{1,3}$/.test(parts[0])) return false
  return parts.slice(1).every((p) => /^[0-9]{3}$/.test(p))
}
