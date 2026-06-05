export type TechnicianRef = { id: string; nome_completo: string }
export type ReasonRef = { id: string; motivo_original: string }

export function matchTechnician(
  rawName: string,
  technicians: TechnicianRef[],
): TechnicianRef | null {
  // Remove prefixo "WAVE - " (e variantes) antes do match
  const clean = rawName.replace(/^WAVE\s*-\s*/i, '').trim()
  return (
    technicians.find(
      (t) => t.nome_completo.trim().toLowerCase() === clean.toLowerCase(),
    ) ?? null
  )
}

export function matchReason(sucesso: string, reasons: ReasonRef[]): ReasonRef | null {
  // Visitas com sucesso não têm motivo de falha
  if (sucesso.trim().toLowerCase().startsWith('sim')) return null
  return reasons.find((r) => r.motivo_original === sucesso.trim()) ?? null
}
