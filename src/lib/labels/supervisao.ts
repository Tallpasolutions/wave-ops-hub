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
  // Nome do ícone lucide-react. Só a situação tem — é o que a agenda do gestor mostra por
  // slot, e precisa casar com o rótulo da lista.
  icone?: string
}

const NEUTRO_FRACO = 'bg-white/5 text-[var(--text-3)]'
const NEUTRO = 'bg-white/5 text-[var(--text-2)]'
const VERDE = 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
const VERDE_FORTE = 'bg-[rgba(46,230,168,0.2)] text-[var(--green)]'
const AMARELO = 'bg-[rgba(250,204,21,0.12)] text-yellow-400'
const VERMELHO = 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]'
const CIANO = 'bg-[rgba(0,212,255,0.12)] text-[var(--cyan)]'

const DESCONHECIDO: RotuloSupervisao = {
  curto: 'Desconhecido',
  detalhado: 'Situação desconhecida',
  cls: NEUTRO_FRACO,
}

// ── Situação da supervisão ─────────────────────────────────────────────────────────────────
// `icone` é o nome de um ícone do lucide-react, resolvido pela tela. Fica aqui, junto do
// rótulo e da cor, para o símbolo da agenda não divergir do texto da lista — que é o que
// acontece quando cada tela escolhe o seu.
export const SUPERVISAO_STATUS: Record<StatusSupervisao, RotuloSupervisao> = {
  agendada: {
    curto: 'Agendada',
    detalhado: 'Agendada, aguardando o supervisor sair',
    cls: NEUTRO,
    icone: 'CalendarClock',
  },
  em_deslocamento: {
    curto: 'A caminho',
    detalhado: 'Supervisor em deslocamento para o local',
    cls: CIANO,
    icone: 'Navigation',
  },
  em_execucao: {
    curto: 'Em campo',
    detalhado: 'Vistoria em andamento',
    cls: AMARELO,
    icone: 'ClipboardCheck',
  },
  concluida: {
    curto: 'Concluída',
    detalhado: 'Vistoria finalizada pelo supervisor',
    cls: VERDE,
    icone: 'CircleCheck',
  },
  cancelada: {
    curto: 'Cancelada',
    detalhado: 'Cancelada',
    cls: NEUTRO_FRACO,
    icone: 'CircleSlash',
  },
}

export function supervisaoStatusLabel(status: string): RotuloSupervisao {
  return SUPERVISAO_STATUS[status as StatusSupervisao] ?? DESCONHECIDO
}

// ── Resposta de um item do checklist ───────────────────────────────────────────────────────
// Estes são os rótulos GENÉRICOS e as cores. O texto que o supervisor lê em cada item vem da
// escala dele (`labelResposta` em src/lib/supervisao/tipo-resposta.ts): a mesma resposta
// `conforme` se lê "Está usando" num item de uso de EPI e "Possui e em bom estado" num de
// posse. Aqui fica o que é comum às três escalas.
export const SUPERVISAO_RESPOSTA: Record<RespostaChecklist, RotuloSupervisao> = {
  conforme: { curto: 'Conforme', detalhado: 'Conforme', cls: VERDE },
  nao_conforme: { curto: 'Não conforme', detalhado: 'Não conforme', cls: VERMELHO },
  // Falha, como `nao_conforme` — equipamento gasto não protege — mas com cor própria: a ação
  // do gestor é repor, não comprar.
  necessita_troca: {
    curto: 'Trocar',
    detalhado: 'Necessário trocar — conta como falha na nota',
    cls: AMARELO,
  },
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
