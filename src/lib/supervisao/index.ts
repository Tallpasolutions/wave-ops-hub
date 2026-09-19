export { calcularNota, isChecklistCompleto } from './score'
export type { RespostaChecklist, ItemAvaliado, ResultadoNota } from './score'

export {
  TRANSICOES,
  podeTransicionar,
  isTerminal,
  estaEmAndamento,
  podeReatribuirSupervisor,
  proximaAcao,
} from './status'
export type { StatusSupervisao, AcaoSupervisor } from './status'

export { PARECERES, isParecerValido } from './parecer'
export type { ParecerFinal } from './parecer'

export {
  TIPOS_RESPOSTA,
  ESCALAS,
  escalaDe,
  isTipoRespostaValido,
  labelResposta,
} from './tipo-resposta'
export type { TipoResposta, EscalaResposta, OpcaoResposta } from './tipo-resposta'

export { buildSnapshot, podeAgendar } from './snapshot'
export type { ItemDoTemplate, LinhaDeResposta, ContextoSnapshot } from './snapshot'

// guard.ts NÃO é reexportado aqui de propósito: é 'server-only', e este barrel também é
// importado por Client Component. Importe direto de '@/lib/supervisao/guard'.
