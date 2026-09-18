// Máquina de estados da supervisão de campo (ADR-022). Pura, sem I/O.
//
// O gestor agenda; o supervisor inicia e conclui. Cancelar é possível enquanto não concluiu.
// 'concluida' e 'cancelada' são terminais: supervisão concluída não reabre, porque a nota já
// foi congelada e reabrir produziria histórico divergente.

export type StatusSupervisao = 'agendada' | 'em_execucao' | 'concluida' | 'cancelada'

export const TRANSICOES: Record<StatusSupervisao, readonly StatusSupervisao[]> = {
  agendada: ['em_execucao', 'cancelada'],
  em_execucao: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
}

export function podeTransicionar(de: StatusSupervisao, para: StatusSupervisao): boolean {
  return TRANSICOES[de].includes(para)
}

export function isTerminal(status: StatusSupervisao): boolean {
  return TRANSICOES[status].length === 0
}

// Reatribuir o supervisor só é permitido antes de a execução começar: supervisor_user_id é
// desnormalizado em supervision_answers e supervision_photos para a RLS filtrar sem join, e
// trocá-lo com respostas ou fotos já gravadas exigiria atualizar tudo em sincronia.
export function podeReatribuirSupervisor(status: StatusSupervisao): boolean {
  return status === 'agendada'
}
