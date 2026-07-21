export type TechnicianRef = { id: string; nome_completo: string }
export type ReasonRef = { id: string; motivo_original: string }

// Normaliza para comparação tolerante: remove diacríticos, colapsa espaços
// internos (inclui espaço duplo, tab e NBSP — que o navegador esconde na
// exibição, mas quebravam o match exato) e baixa a caixa.
function normalizeStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

// Prefixo de organização que aparece na planilha da Unetvale ("WAVE - ", "INFRA WAVE - ").
const ORG_PREFIX = /^\s*(?:INFRA\s+)?WAVE\s*-\s*/i

export function matchTechnician(
  rawName: string,
  technicians: TechnicianRef[],
): TechnicianRef | null {
  // Remove o prefixo dos DOIS lados: parte dos técnicos foi cadastrada COM o prefixo no
  // nome_completo (ex: "INFRA WAVE - Joao Revair Dill"). Removê-lo só do nome cru fazia o
  // match falhar sempre nesses casos — toda visita entrava sem técnico. Normalizar ambos
  // casa tanto cadastros com prefixo quanto sem.
  const clean = normalizeStr(rawName.replace(ORG_PREFIX, ''))
  return (
    technicians.find((t) => normalizeStr(t.nome_completo.replace(ORG_PREFIX, '')) === clean) ??
    null
  )
}

export function matchReason(sucesso: string, reasons: ReasonRef[]): ReasonRef | null {
  // Visitas com sucesso não têm motivo de falha
  if (sucesso.trim().toLowerCase().startsWith('sim')) return null
  return reasons.find((r) => r.motivo_original === sucesso.trim()) ?? null
}
