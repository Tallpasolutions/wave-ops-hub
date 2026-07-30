// Fonte única dos rótulos de status de pagamento.
//
// Antes cada tela tinha seu próprio mapa: /pagamentos, /pagamentos/[id] e o sheet de
// /motivos traduziam por conta própria, com rótulos divergentes para o MESMO status, e os
// dois últimos nem listavam `contestado` e `pending_calculation` — que caíam num fallback
// `?? status` e apareciam crus na tela do gestor.
//
// O Record é exaustivo sobre DbPayoutStatus: um status novo no schema quebra a compilação
// aqui, em vez de vazar em inglês para a Wave. É o que impede a reincidência.

import type { DbPayoutStatus } from '@/lib/payouts/types'

export type PayoutStatusLabel = {
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

export const PAYOUT_STATUS: Record<DbPayoutStatus, PayoutStatusLabel> = {
  pending_calculation: { curto: 'Calculando', detalhado: 'Calculando', cls: NEUTRO_FRACO },
  pending_review: {
    curto: 'Aguardando',
    detalhado: 'Aguardando fechamento',
    cls: NEUTRO,
  },
  pending: { curto: 'Pendente', detalhado: 'Pendente', cls: NEUTRO },
  approved: { curto: 'Aprovado', detalhado: 'Aprovado', cls: VERDE },
  paid: { curto: 'Pago', detalhado: 'Pago', cls: VERDE_FORTE },
  contestado: { curto: 'Contestado', detalhado: 'Contestado pelo técnico', cls: AMARELO },
  // "Override" é o nome da coluna no banco, não vocabulário da Wave.
  override: { curto: 'Ajuste manual', detalhado: 'Ajuste manual do gestor', cls: AMARELO },
  no_rule_match: { curto: 'Sem regra', detalhado: 'Sem regra de LPU', cls: VERMELHO },
  pending_classification: {
    curto: 'Motivo pendente',
    detalhado: 'Motivo pendente de classificação',
    cls: VERMELHO,
  },
  conflict: { curto: 'Conflito', detalhado: 'Conflito de prioridade', cls: VERMELHO },
}

// Status vindo do banco é `string` no tipo do PostgREST. Um valor fora do enum só aconteceria
// com dado corrompido — nesse caso o gestor vê "Desconhecido", nunca o identificador técnico.
const DESCONHECIDO: PayoutStatusLabel = {
  curto: 'Desconhecido',
  detalhado: 'Status desconhecido',
  cls: NEUTRO_FRACO,
}

export function payoutStatusLabel(status: string): PayoutStatusLabel {
  return PAYOUT_STATUS[status as DbPayoutStatus] ?? DESCONHECIDO
}
