// Exibição unificada de técnico (Sprint 12 — Fase B).
// Antes, técnico sem vínculo aparecia como "Sem técnico"/"Não vinculado"/"Técnico
// desconhecido" dependendo da tela, escondendo o nome que a planilha já traz
// ("WAVE - Douglas Ribeiro"). Regra única: nome cadastrado > nome bruto da planilha
// com sufixo "(não vinculado)" > "Sem técnico" quando nem o bruto existe.

const WAVE_PREFIX = /^WAVE\s*-\s*/i

export function stripWavePrefix(raw: string): string {
  return raw.replace(WAVE_PREFIX, '').trim()
}

export function tecnicoDisplayName(
  nomeCompleto: string | null | undefined,
  tecnicoRaw?: string | null,
): string {
  if (nomeCompleto) return nomeCompleto
  const raw = tecnicoRaw ? stripWavePrefix(tecnicoRaw) : ''
  return raw ? `${raw} (não vinculado)` : 'Sem técnico'
}

// Chave de agrupamento: visitas vinculadas agrupam pelo id; não vinculadas agrupam
// pelo nome bruto (em vez de um balde único "Sem técnico" que mistura pessoas).
export function tecnicoGroupKey(
  tecnicoId: string | null | undefined,
  tecnicoRaw?: string | null,
): string {
  if (tecnicoId) return tecnicoId
  const raw = tecnicoRaw ? stripWavePrefix(tecnicoRaw).toLowerCase() : ''
  return raw ? `raw:${raw}` : '__sem_tecnico__'
}
