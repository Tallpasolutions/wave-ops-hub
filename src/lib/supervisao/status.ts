// Máquina de estados da supervisão de campo (ADR-022). Pura, sem I/O.
//
// O gestor agenda. O supervisor registra em campo, pelo celular, três momentos: saiu para o
// local, começou a vistoria, terminou. Cada transição carimba a hora, e é isso que permite ao
// gestor acompanhar a agenda do dia sem ligar para ninguém.
//
// 'concluida' e 'cancelada' são terminais: a nota já foi congelada, e reabrir produziria
// histórico divergente.

export type StatusSupervisao =
  | 'agendada'
  | 'em_deslocamento'
  | 'em_execucao'
  | 'concluida'
  | 'cancelada'

export const TRANSICOES: Record<StatusSupervisao, readonly StatusSupervisao[]> = {
  // O deslocamento é registrável, não obrigatório: o supervisor que já está no local — ou que
  // esqueceu de marcar a saída — precisa conseguir começar a vistoria mesmo assim. Ter ido
  // direto para a execução é, em si, informação para o gestor.
  agendada: ['em_deslocamento', 'em_execucao', 'cancelada'],
  em_deslocamento: ['em_execucao', 'cancelada'],
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

// Estados em que a supervisão está acontecendo agora — o que o gestor quer ver destacado na
// agenda do dia.
export function estaEmAndamento(status: StatusSupervisao): boolean {
  return status === 'em_deslocamento' || status === 'em_execucao'
}

// Reatribuir o supervisor só é permitido antes de a execução começar: supervisor_user_id é
// desnormalizado em supervision_answers e supervision_photos para a RLS filtrar sem join, e
// trocá-lo com respostas ou fotos já gravadas exigiria atualizar tudo em sincronia.
export function podeReatribuirSupervisor(status: StatusSupervisao): boolean {
  return status === 'agendada' || status === 'em_deslocamento'
}

// A ação que o supervisor vê no app, em função de onde a supervisão está. Null quando não há
// nada a fazer — supervisão terminada ou cancelada.
export interface AcaoSupervisor {
  label: string
  proximoStatus: StatusSupervisao
}

export function proximaAcao(status: StatusSupervisao): AcaoSupervisor | null {
  switch (status) {
    case 'agendada':
      return { label: 'Iniciar deslocamento', proximoStatus: 'em_deslocamento' }
    case 'em_deslocamento':
      return { label: 'Iniciar vistoria', proximoStatus: 'em_execucao' }
    case 'em_execucao':
      return { label: 'Finalizar vistoria', proximoStatus: 'concluida' }
    default:
      return null
  }
}
