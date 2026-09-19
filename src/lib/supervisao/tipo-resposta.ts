// Escalas de resposta do checklist (ADR-022, revisto na Sprint 19 a partir da ficha de
// EPI/EPC que a Wave usava no Google Forms).
//
// A ficha original tinha DUAS escalas diferentes, e a distinção é operacional, não cosmética:
//
//   Posse: "Sim e está em boas condições" | "Não" | "Necessário trocar"
//   Uso:   "Está usando" | "Não está usando" | "Não se aplica ao momento"
//
// "Não possui" e "Necessário trocar" são problemas distintos — um é técnico sem equipamento,
// o outro é equipamento gasto. Achatar os dois em "não conforme" apagaria a diferença que
// decide a ação. Por isso `necessita_troca` é um estado próprio, que conta como falha na nota
// mas aparece separado nos contadores.

import type { RespostaChecklist } from './score'

export const TIPOS_RESPOSTA = ['conformidade', 'posse_epi', 'uso_epi'] as const
export type TipoResposta = (typeof TIPOS_RESPOSTA)[number]

export interface OpcaoResposta {
  valor: RespostaChecklist
  label: string
}

export interface EscalaResposta {
  tipo: TipoResposta
  nome: string
  descricao: string
  opcoes: readonly OpcaoResposta[]
}

export const ESCALAS: Record<TipoResposta, EscalaResposta> = {
  conformidade: {
    tipo: 'conformidade',
    nome: 'Conformidade',
    descricao: 'Para verificações gerais de procedimento, postura e qualidade.',
    opcoes: [
      { valor: 'conforme', label: 'Conforme' },
      { valor: 'nao_conforme', label: 'Não conforme' },
      { valor: 'nao_se_aplica', label: 'Não se aplica' },
    ],
  },
  posse_epi: {
    tipo: 'posse_epi',
    nome: 'Posse de EPI',
    descricao: 'O técnico tem o equipamento, e em que estado.',
    opcoes: [
      { valor: 'conforme', label: 'Possui e em bom estado' },
      { valor: 'nao_conforme', label: 'Não possui' },
      { valor: 'necessita_troca', label: 'Necessário trocar' },
    ],
  },
  uso_epi: {
    tipo: 'uso_epi',
    nome: 'Uso de EPI',
    descricao: 'O técnico está usando o equipamento no momento da visita.',
    opcoes: [
      { valor: 'conforme', label: 'Está usando' },
      { valor: 'nao_conforme', label: 'Não está usando' },
      { valor: 'nao_se_aplica', label: 'Não se aplica ao momento' },
    ],
  },
}

export function isTipoRespostaValido(valor: unknown): valor is TipoResposta {
  return typeof valor === 'string' && (TIPOS_RESPOSTA as readonly string[]).includes(valor)
}

export function escalaDe(tipo: string): EscalaResposta {
  return isTipoRespostaValido(tipo) ? ESCALAS[tipo] : ESCALAS.conformidade
}

// Rótulo da resposta DENTRO da escala do item. A mesma resposta `conforme` se lê "Conforme"
// num item de procedimento e "Está usando" num item de uso de EPI — mostrar o rótulo errado
// faria o gestor ler o histórico de forma equivocada.
export function labelResposta(tipo: string, resposta: RespostaChecklist | null): string {
  if (resposta === null) return 'Pendente'

  const naEscala = escalaDe(tipo).opcoes.find((o) => o.valor === resposta)
  if (naEscala) return naEscala.label

  // Resposta fora da escala do item. Acontece de verdade: o gestor troca um item de "posse"
  // para "uso" depois de ele já ter sido respondido com "necessário trocar". A resposta
  // continua válida no histórico e precisa de rótulo — procura em TODAS as escalas, porque
  // nenhuma delas sozinha cobre os quatro estados.
  for (const escala of Object.values(ESCALAS)) {
    const achada = escala.opcoes.find((o) => o.valor === resposta)
    if (achada) return achada.label
  }
  return 'Desconhecido'
}
