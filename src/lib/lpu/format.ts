// Tradução de uma regra de LPU para português legível.
//
// As telas do gestor mostravam `conditions` e `payout` como JSON cru (`{"type":"fixed",
// "value":20}` embaixo de "Regra LPU aplicada"). Formatar é lógica de domínio — conhece os
// tipos de payout e o vocabulário da Wave —, então mora aqui e não no componente.
//
// Sem fallback silencioso: chave de condição desconhecida é erro de tipo em tempo de
// compilação (o Record é exaustivo sobre VisitForMatch), não texto técnico vazando na tela.

import type { ConditionValue, PayoutNarrowed, VisitForMatch } from './types'

const CAMPO_LABEL: Record<keyof VisitForMatch, string> = {
  finalidade: 'Finalidade',
  tipoAtendimento: 'Tipo de atendimento',
  sucesso: 'Resultado',
  cidade: 'Cidade',
  condominio: 'Condomínio',
  dropUsado: 'Drop usado',
  faixaDrop: 'Faixa de drop',
  conectoresUsados: 'Conectores usados',
  garantia: 'Garantia',
  subterraneaAereo: 'Rede',
  valorRecebidoUnetvale: 'Valor recebido da Unetvale',
  tecnicoId: 'Técnico',
  agregada: 'Venda atrelada',
}

// Campos cujo valor é dinheiro — muda "40" para "R$ 40,00" na descrição da faixa.
const CAMPOS_EM_REAIS = new Set<keyof VisitForMatch>(['valorRecebidoUnetvale'])

export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function isFaixa(v: ConditionValue): v is { min?: number; max?: number } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function formatValorCondicao(campo: keyof VisitForMatch, valor: ConditionValue): string {
  const emReais = CAMPOS_EM_REAIS.has(campo)
  const num = (n: number) => (emReais ? formatBRL(n) : String(n))

  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  if (typeof valor === 'number') return num(valor)
  if (typeof valor === 'string') return valor
  if (Array.isArray(valor)) {
    const itens = valor.map((v) => (typeof v === 'number' ? num(v) : String(v)))
    if (itens.length === 1) return itens[0]
    // "A, B ou C" — a condição casa quando o valor da visita é QUALQUER um da lista.
    return `${itens.slice(0, -1).join(', ')} ou ${itens[itens.length - 1]}`
  }
  if (isFaixa(valor)) {
    const { min, max } = valor
    if (min != null && max != null) return `entre ${num(min)} e ${num(max)}`
    if (min != null) return `a partir de ${num(min)}`
    if (max != null) return `até ${num(max)}`
  }
  return '—'
}

export type CondicaoLegivel = { campo: string; valor: string }

// Uma linha por condição, na ordem em que foram declaradas na regra.
export function formatConditions(
  conditions: Partial<Record<keyof VisitForMatch, ConditionValue>>,
): CondicaoLegivel[] {
  return (Object.entries(conditions) as [keyof VisitForMatch, ConditionValue][])
    .filter(([, valor]) => valor !== undefined && valor !== null)
    .map(([campo, valor]) => ({
      campo: CAMPO_LABEL[campo] ?? campo,
      valor: formatValorCondicao(campo, valor),
    }))
}

// Como o valor do pagamento é calculado, em uma frase.
export function formatPayout(payout: PayoutNarrowed): string {
  switch (payout.type) {
    case 'fixed':
      return payout.value === 0
        ? 'Não paga (R$ 0,00)'
        : `Valor fixo de ${formatBRL(payout.value)}`
    case 'formula': {
      const campo = CAMPO_LABEL[payout.additional.field] ?? payout.additional.field
      return `${formatBRL(payout.base)} + ${formatBRL(payout.additional.ratePerUnit)} por unidade de ${campo.toLowerCase()}`
    }
    case 'percentage_of_revenue':
      return `${payout.percentage}% do valor recebido da Unetvale`
  }
}
