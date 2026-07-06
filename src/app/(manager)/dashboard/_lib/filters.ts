// Drill-down do dashboard (ADR-010): estado 100% na URL, filtros combináveis (AND).
// Uma dimensão por parâmetro; setar o mesmo valor remove (toggle). `mes` e demais params
// são sempre preservados — toda navegação passa por estes helpers para não perder estado
// (lição do staleness da Sprint 13).

export const FILTER_KEYS = ['finalidade', 'cidade', 'tecnico', 'tipo'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type DashboardFilters = Partial<Record<FilterKey, string>>

// Coluna do banco correspondente a cada dimensão de filtro.
export const FILTER_COLUMN: Record<FilterKey, string> = {
  finalidade: 'finalidade',
  cidade: 'cidade',
  tecnico: 'tecnico_id',
  tipo: 'tipo_atendimento',
}

export const FILTER_LABEL: Record<FilterKey, string> = {
  finalidade: 'Finalidade',
  cidade: 'Cidade',
  tecnico: 'Técnico',
  tipo: 'Tipo',
}

export function parseFilters(sp: Record<string, string | undefined>): DashboardFilters {
  const out: DashboardFilters = {}
  for (const key of FILTER_KEYS) {
    const v = sp[key]
    if (v && v.trim()) out[key] = v
  }
  return out
}

export function hasFilters(f: DashboardFilters): boolean {
  return FILTER_KEYS.some((k) => f[k] != null)
}

// Toggle de um filtro sobre a querystring atual, preservando os demais params.
// Retorna a nova querystring (sem "?"). Setar o valor já ativo remove (toggle).
export function toggleFilter(
  current: URLSearchParams,
  key: FilterKey,
  value: string,
): string {
  const next = new URLSearchParams(current)
  if (next.get(key) === value) next.delete(key)
  else next.set(key, value)
  return next.toString()
}

export function removeFilter(current: URLSearchParams, key: FilterKey): string {
  const next = new URLSearchParams(current)
  next.delete(key)
  return next.toString()
}

export function clearFilters(current: URLSearchParams): string {
  const next = new URLSearchParams(current)
  for (const key of FILTER_KEYS) next.delete(key)
  return next.toString()
}
