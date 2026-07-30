// ADR-014: o tenant tem uma LPU padrão (`ativa = true`) e pode ter tabelas alternativas
// atribuídas a técnicos específicos via `technicians.lpu_id` (ex.: "SEM AUXILIAR"). O payout
// grava em `lpu_id` a tabela que de fato pagou aquela visita, então a origem do valor é um
// dado que já existe — este módulo só decide como mostrá-la ao gestor.
//
// Regra de exibição: a tabela padrão NÃO é sinalizada em listas. Marcar todas as linhas com
// "LPU Wave 2026 — Revisada" viraria ruído e esconderia justamente o que importa — a exceção.
// Nas telas de detalhe a tabela aparece sempre, porque ali o gestor está conferindo um caso.

export type LpuDaPayout = {
  nome: string
  ativa: boolean
} | null

// Normaliza o embed do PostgREST, que devolve objeto ou array conforme a cardinalidade inferida.
export function lpuFromEmbed(embed: unknown): LpuDaPayout {
  if (!embed) return null
  const row = Array.isArray(embed) ? embed[0] : embed
  if (!row || typeof row !== 'object') return null
  const { nome, ativa } = row as { nome?: unknown; ativa?: unknown }
  if (typeof nome !== 'string') return null
  return { nome, ativa: ativa === true }
}

// Nome a exibir em listas: só para tabela alternativa. `null` = não sinalizar.
export function tabelaAlternativaLabel(lpu: LpuDaPayout): string | null {
  if (!lpu || lpu.ativa) return null
  return lpu.nome
}

// Texto para telas de detalhe, onde a tabela aparece sempre. Sem LPU registrada (payout
// resolvido fora do motor — cabeamento, homologação, improdutiva) o valor não veio de tabela.
export function tabelaPrecoDetalhe(lpu: LpuDaPayout): string {
  if (!lpu) return 'Não definida por tabela de preços'
  return lpu.ativa ? `${lpu.nome} (padrão)` : lpu.nome
}
