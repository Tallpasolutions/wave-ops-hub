// Fonte única dos rótulos da supervisão de campo (ADR-022).
//
// Mesma razão de existir de payout-status.ts: mapa de rótulo duplicado em tela, com fallback
// silencioso, é a causa raiz documentada de identificador de banco vazar para a Wave. Aqui os
// Records são exaustivos sobre os tipos do domínio — status, resposta ou parecer novo quebra a
// compilação neste arquivo, em vez de aparecer como `nao_se_aplica` na tela.

import type { StatusSupervisao } from '@/lib/supervisao/status'
import type { RespostaChecklist } from '@/lib/supervisao/score'
import type { ParecerFinal } from '@/lib/supervisao/parecer'

export type RotuloSupervisao = {
  // Listas e tabelas, onde o espaço é curto.
  curto: string
  // Telas de detalhe, onde cabe a explicação completa.
  detalhado: string
  cls: string
}

const NEUTRO_FRACO = 'bg-white/5 text-[var(--text-3)]'
const NEUTRO = 'bg-white/5 text-[var(--text-2)]'
const VERDE = 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
const VERDE_FORTE = 'bg-[rgba(46,230,168,0.2)] text-[var(--green)]'
const AMARELO = 'bg-[rgba(250,204,21,0.12)] text-yellow-400'
const VERMELHO = 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]'

const DESCONHECIDO: RotuloSupervisao = {
  curto: 'Desconhecido',
  detalhado: 'Situação desconhecida',
  cls: NEUTRO_FRACO,
}

// ── Situação da supervisão ─────────────────────────────────────────────────────────────────
export const SUPERVISAO_STATUS: Record<StatusSupervisao, RotuloSupervisao> = {
  agendada: { curto: 'Agendada', detalhado: 'Agendada, aguardando o supervisor', cls: NEUTRO },
  em_execucao: { curto: 'Em campo', detalhado: 'Em execução no campo', cls: AMARELO },
  concluida: { curto: 'Concluída', detalhado: 'Concluída pelo supervisor', cls: VERDE },
  cancelada: { curto: 'Cancelada', detalhado: 'Cancelada', cls: NEUTRO_FRACO },
}

export function supervisaoStatusLabel(status: string): RotuloSupervisao {
  return SUPERVISAO_STATUS[status as StatusSupervisao] ?? DESCONHECIDO
}

// ── Resposta de um item do checklist ───────────────────────────────────────────────────────
export const SUPERVISAO_RESPOSTA: Record<RespostaChecklist, RotuloSupervisao> = {
  conforme: { curto: 'Conforme', detalhado: 'Conforme', cls: VERDE },
  nao_conforme: { curto: 'Não conforme', detalhado: 'Não conforme', cls: VERMELHO },
  // Fica fora do cálculo da nota (ADR-022): não avaliado não é reprovado.
  nao_se_aplica: {
    curto: 'Não se aplica',
    detalhado: 'Não se aplica — fora do cálculo da nota',
    cls: NEUTRO_FRACO,
  },
}

export function respostaLabel(resposta: string | null): RotuloSupervisao {
  if (resposta === null) {
    return { curto: 'Pendente', detalhado: 'Ainda não respondido', cls: NEUTRO }
  }
  return SUPERVISAO_RESPOSTA[resposta as RespostaChecklist] ?? DESCONHECIDO
}

// ── Parecer final do supervisor ────────────────────────────────────────────────────────────
export const SUPERVISAO_PARECER: Record<ParecerFinal, RotuloSupervisao> = {
  aprovado: { curto: 'Aprovado', detalhado: 'Aprovado', cls: VERDE_FORTE },
  aprovado_com_ressalvas: {
    curto: 'Com ressalvas',
    detalhado: 'Aprovado com ressalvas',
    cls: AMARELO,
  },
  reprovado: { curto: 'Reprovado', detalhado: 'Reprovado', cls: VERMELHO },
  reciclagem_recomendada: {
    curto: 'Reciclagem',
    detalhado: 'Reciclagem recomendada',
    cls: AMARELO,
  },
}

export function parecerLabel(parecer: string | null): RotuloSupervisao {
  if (parecer === null) {
    return { curto: 'Sem parecer', detalhado: 'Ainda sem parecer', cls: NEUTRO }
  }
  return SUPERVISAO_PARECER[parecer as ParecerFinal] ?? DESCONHECIDO
}

// Nota nula significa "nenhum item avaliável" (tudo "não se aplica"), NÃO zero. Zero é
// "avaliado e reprovado em tudo" — mostrar 0 nos dois casos apagaria a diferença.
export function notaLabel(nota: number | string | null): string {
  if (nota === null || nota === undefined) return '—'
  const valor = typeof nota === 'string' ? Number(nota) : nota
  if (Number.isNaN(valor)) return '—'
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
