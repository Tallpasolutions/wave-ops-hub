// Estado de uma LPU derivado dos campos existentes (Sprint 14 S5) — sem coluna nova.
// Ciclo: createLpu grava ativa=false, vigencia_fim=null (rascunho); activateLpu ativa a nova e
// grava vigencia_fim na anterior (encerrada). Antes desta correção, toda LPU não-ativa —
// inclusive as encerradas — aparecia como "Rascunho".

export type LpuStatus = 'ativa' | 'encerrada' | 'rascunho'

export function lpuStatus(ativa: boolean, vigenciaFim: string | null): LpuStatus {
  if (ativa) return 'ativa'
  if (vigenciaFim) return 'encerrada'
  return 'rascunho'
}

export const LPU_STATUS_LABEL: Record<LpuStatus, string> = {
  ativa: 'Ativa',
  encerrada: 'Encerrada',
  rascunho: 'Rascunho',
}

export const LPU_STATUS_CLASS: Record<LpuStatus, string> = {
  ativa: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]',
  encerrada: 'bg-white/5 text-[var(--text-3)]',
  rascunho: 'bg-[rgba(255,181,71,0.12)] text-[var(--amber)]',
}
