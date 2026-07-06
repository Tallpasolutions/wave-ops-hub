// Parse de número em formato brasileiro vindo da planilha (Unetvale).
// Bug corrigido: `Number("4.688,83")` = NaN → o valor era zerado silenciosamente; e
// `Number("1.000")` = 1 (JS trata "." como decimal). Em pt-BR o "." é separador de milhar
// e a "," é o decimal.
//
// Regra: se houver vírgula, ela é o decimal → remove os pontos (milhar) e troca a vírgula
// por ponto. Sem vírgula, os pontos são milhar → remove todos. Números já numéricos passam
// direto (células numéricas do xlsx chegam como number).
export function parseBrNumber(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (v === null || v === undefined) return 0

  const s = String(v).trim()
  if (s === '' || s === '-') return 0

  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.') // "4.688,83" → "4688.83"
    : s.replace(/\./g, '') // "1.000" → "1000"

  const n = Number(normalized)
  return isNaN(n) ? 0 : n
}
