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

export function matchTechnician(
  rawName: string,
  technicians: TechnicianRef[],
): TechnicianRef | null {
  // Remove o prefixo de organização ("WAVE - " e "INFRA WAVE - ") antes do match.
  const clean = normalizeStr(rawName.replace(/^\s*(?:INFRA\s+)?WAVE\s*-\s*/i, ''))
  return (
    technicians.find((t) => normalizeStr(t.nome_completo) === clean) ?? null
  )
}

export function matchReason(sucesso: string, reasons: ReasonRef[]): ReasonRef | null {
  // Visitas com sucesso não têm motivo de falha
  if (sucesso.trim().toLowerCase().startsWith('sim')) return null
  return reasons.find((r) => r.motivo_original === sucesso.trim()) ?? null
}
