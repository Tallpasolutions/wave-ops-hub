// Normalização da coluna Z (`explicacao_valor`) para classificação de Cabeamento (ADR-009).
//
// A chave agrupa visitas que devem receber o MESMO payout. O que distingue o valor é o
// serviço (texto antes do "|") e o modificador de pontos ("(+N ponto(s) adicional(is))").
// O valor-base após o "|" (73, 88, 176 * 1.1) é a receita da Unetvale — ruído para o payout —
// e os sufixos de reajuste são constantes. Removemos ambos; preservamos serviço + pontos.
//
// ADR-016: o modificador de pontos ("(+73 * N ponto(s) adicional(is))") deixou de fazer parte
// da chave — o ponto adicional virou um acréscimo uniforme (+R$ 36; ver calculate.ts) somado
// sobre o valor-base do serviço. Assim as variantes com ponto colapsam na chave-base e o valor
// é a base + N × 36 (antes o ponto ficava embutido na classificação, com incremento inconsistente).
//
// Exemplos:
//   "Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)"          → "Cabeamento agregado"
//   "Cabeamento fibra aérea | 176 * 1.1 (+10% reajuste geral ...) (...)" → "Cabeamento fibra aérea"
//   "Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) (Reajuste ...)"    → "Cabeamento"
// ADR-015: homologação é reconhecida pelo início da coluna Z ("Homologa..."),
// independente da finalidade. `startsWith("homologa")` cobre "Homologação",
// "Homologacao" e variações de acento/caixa.
export function isHomologacao(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw.trim().toLowerCase().startsWith("homologa");
}

// ADR-016: quantidade de pontos adicionais na coluna Z ("(+73 * N ponto(s) adicional(is))").
// Retorna 0 quando não há o modificador. Só o N importa; o "+73" é a receita da Unetvale.
export function parsePontosAdicionais(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/\(\s*\+\s*[\d.,]+\s*\*\s*(\d+)\s*ponto/i);
  return m ? parseInt(m[1], 10) : 0;
}

export function normalizeExplicacao(raw: string | null | undefined): string {
  if (!raw) return "";
  return (
    raw
      // sufixos de reajuste (anotações de valor, não de serviço)
      .replace(/\(Reajuste[^)]*\)/gi, "")
      .replace(/\(\+\s*[\d.,]+\s*%\s*reajuste geral[^)]*\)/gi, "")
      // ADR-016: modificador de pontos vira acréscimo separado — fora da chave.
      // Tolera os parênteses internos de "ponto(s) adicional(is)".
      .replace(/\(\s*\+(?:[^()]|\([^()]*\))*ponto(?:[^()]|\([^()]*\))*\)/gi, "")
      // valor-base logo após o "|" (ex.: "| 88", "| 176 * 1.1")
      .replace(/\|\s*[\d.,]+(?:\s*\*\s*[\d.,]+)?/g, "")
      // colapsa espaços
      .replace(/\s+/g, " ")
      .trim()
  );
}
