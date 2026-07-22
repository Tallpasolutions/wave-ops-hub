// Normalização da coluna Z (`explicacao_valor`) para classificação de Cabeamento (ADR-009).
//
// A chave agrupa visitas que devem receber o MESMO payout. O que distingue o valor é o
// serviço (texto antes do "|") e o modificador de pontos ("(+N ponto(s) adicional(is))").
// O valor-base após o "|" (73, 88, 176 * 1.1) é a receita da Unetvale — ruído para o payout —
// e os sufixos de reajuste são constantes. Removemos ambos; preservamos serviço + pontos.
//
// Exemplos:
//   "Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)"          → "Cabeamento agregado"
//   "Cabeamento fibra aérea | 176 * 1.1 (+10% reajuste geral ...) (...)" → "Cabeamento fibra aérea"
//   "Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste ...)"    → "Cabeamento (+73 * 1 ponto(s) adicional(is))"
// ADR-015: homologação é reconhecida pelo início da coluna Z ("Homologa..."),
// independente da finalidade. `startsWith("homologa")` cobre "Homologação",
// "Homologacao" e variações de acento/caixa.
export function isHomologacao(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw.trim().toLowerCase().startsWith("homologa");
}

export function normalizeExplicacao(raw: string | null | undefined): string {
  if (!raw) return "";
  return (
    raw
      // sufixos de reajuste (anotações de valor, não de serviço)
      .replace(/\(Reajuste[^)]*\)/gi, "")
      .replace(/\(\+\s*[\d.,]+\s*%\s*reajuste geral[^)]*\)/gi, "")
      // valor-base logo após o "|" (ex.: "| 88", "| 176 * 1.1"), preservando o modificador de pontos
      .replace(/\|\s*[\d.,]+(?:\s*\*\s*[\d.,]+)?/g, "")
      // colapsa espaços
      .replace(/\s+/g, " ")
      .trim()
  );
}
