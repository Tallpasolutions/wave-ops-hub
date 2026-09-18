export { calcularNota, isChecklistCompleto } from './score'
export type { RespostaChecklist, ItemAvaliado, ResultadoNota } from './score'

export { TRANSICOES, podeTransicionar, isTerminal, podeReatribuirSupervisor } from './status'
export type { StatusSupervisao } from './status'

export { PARECERES, isParecerValido } from './parecer'
export type { ParecerFinal } from './parecer'
