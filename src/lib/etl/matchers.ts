export type TechnicianRef = { id: string; nome_completo: string }
export type ReasonRef = { id: string; motivo_original: string }

// Remove diacríticos para comparação tolerante a variações de encoding da planilha
function normalizeStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function matchTechnician(
  rawName: string,
  technicians: TechnicianRef[],
): TechnicianRef | null {
  // Remove prefixo "WAVE - " (e variantes) antes do match
  const clean = normalizeStr(rawName.replace(/^WAVE\s*-\s*/i, ''))
  return (
    technicians.find((t) => normalizeStr(t.nome_completo) === clean) ?? null
  )
}

export function matchReason(sucesso: string, reasons: ReasonRef[]): ReasonRef | null {
  // Visitas com sucesso não têm motivo de falha
  if (sucesso.trim().toLowerCase().startsWith('sim')) return null
  return reasons.find((r) => r.motivo_original === sucesso.trim()) ?? null
}
