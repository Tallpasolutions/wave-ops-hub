// Nota da supervisão de campo (ADR-022). Função pura: sem I/O, sem Date, não muta a entrada.
//
// A nota é CALCULADA UMA VEZ, na conclusão, e gravada em field_supervisions.nota — nunca
// recalculada em leitura. Mesmo princípio de payouts.valor_calculado: o histórico é um número
// gravado sobre uma cópia congelada dos itens, então mudar a fórmula depois não reescreve o
// passado.
//
// A decisão de domínio está em 'nao_se_aplica' ficar FORA do numerador e do denominador:
// "não avaliado" não é "reprovado". Um item que não se aplicava àquela visita não pode
// derrubar a nota do técnico.

export type RespostaChecklist = 'conforme' | 'nao_conforme' | 'nao_se_aplica'

export interface ItemAvaliado {
  peso: number
  resposta: RespostaChecklist | null // null = ainda não respondido
}

export interface ResultadoNota {
  nota: number | null // 0–100 com 2 casas. null = nenhum item avaliável (a tela mostra "—")
  conformes: number
  naoConformes: number
  naoSeAplica: number
  pendentes: number
  pesoAvaliado: number // denominador efetivo, exposto para auditoria
}

// Half-up em 2 casas, com compensação de epsilon: sem ela, 2/3 vira 66.66999999999999.
function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function calcularNota(itens: readonly ItemAvaliado[]): ResultadoNota {
  let pesoConformes = 0
  let pesoAvaliado = 0
  let conformes = 0
  let naoConformes = 0
  let naoSeAplica = 0
  let pendentes = 0

  for (const item of itens) {
    switch (item.resposta) {
      case 'conforme':
        conformes++
        pesoConformes += item.peso
        pesoAvaliado += item.peso
        break
      case 'nao_conforme':
        naoConformes++
        pesoAvaliado += item.peso
        break
      case 'nao_se_aplica':
        naoSeAplica++
        break
      default:
        pendentes++
    }
  }

  return {
    // Denominador zero (tudo "não se aplica", tudo pendente ou lista vazia) → null, NÃO zero.
    // Nota 0 significa "avaliado e reprovado em tudo"; são coisas diferentes na tela.
    nota: pesoAvaliado > 0 ? arredondar2((pesoConformes / pesoAvaliado) * 100) : null,
    conformes,
    naoConformes,
    naoSeAplica,
    pendentes,
    pesoAvaliado: arredondar2(pesoAvaliado),
  }
}

// Concluir a supervisão exige que todo item tenha resposta — inclusive 'nao_se_aplica'.
// É o que impede uma supervisão parcial virar histórico com nota parecendo completa.
export function isChecklistCompleto(itens: readonly ItemAvaliado[]): boolean {
  return itens.every((item) => item.resposta !== null && item.resposta !== undefined)
}
