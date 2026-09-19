import { describe, expect, it } from 'vitest'
import {
  ESCALAS,
  TIPOS_RESPOSTA,
  escalaDe,
  isTipoRespostaValido,
  labelResposta,
} from '../tipo-resposta'
import { calcularNota } from '../score'

// As escalas existem para a tela falar a língua da operação. A trava que importa é a nota
// continuar a mesma: mudar o rótulo não pode mudar o que conta como acerto.

describe('escalas de resposta', () => {
  it('toda escala tem exatamente 3 opções', () => {
    for (const tipo of TIPOS_RESPOSTA) {
      expect(ESCALAS[tipo].opcoes, tipo).toHaveLength(3)
    }
  })

  it('a PRIMEIRA opção de toda escala é a que conta como conforme', () => {
    for (const tipo of TIPOS_RESPOSTA) {
      expect(ESCALAS[tipo].opcoes[0].valor, tipo).toBe('conforme')
    }
  })

  it('nenhuma escala repete um valor', () => {
    for (const tipo of TIPOS_RESPOSTA) {
      const valores = ESCALAS[tipo].opcoes.map((o) => o.valor)
      expect(new Set(valores).size, tipo).toBe(valores.length)
    }
  })

  it('todo rótulo é em português e começa com maiúscula', () => {
    for (const tipo of TIPOS_RESPOSTA) {
      for (const o of ESCALAS[tipo].opcoes) {
        expect(o.label, `${tipo}/${o.valor}`).toMatch(/^[A-ZÀ-Ý]/)
        expect(o.label, `${tipo}/${o.valor}`).not.toContain('_')
      }
    }
  })

  // A escala de posse veio da ficha de EPI e é a única sem "não se aplica": ou o técnico tem
  // o equipamento, ou não tem, ou tem gasto.
  it('posse de EPI oferece "necessário trocar" no lugar de "não se aplica"', () => {
    const valores = ESCALAS.posse_epi.opcoes.map((o) => o.valor)
    expect(valores).toContain('necessita_troca')
    expect(valores).not.toContain('nao_se_aplica')
  })

  it('uso de EPI e conformidade oferecem "não se aplica"', () => {
    expect(ESCALAS.uso_epi.opcoes.map((o) => o.valor)).toContain('nao_se_aplica')
    expect(ESCALAS.conformidade.opcoes.map((o) => o.valor)).toContain('nao_se_aplica')
  })
})

describe('escalaDe', () => {
  it('devolve a escala pedida', () => {
    expect(escalaDe('posse_epi').tipo).toBe('posse_epi')
  })

  it('tipo desconhecido cai em conformidade em vez de quebrar a tela', () => {
    expect(escalaDe('algo_que_nao_existe').tipo).toBe('conformidade')
    expect(escalaDe('').tipo).toBe('conformidade')
  })
})

describe('isTipoRespostaValido', () => {
  it('aceita os três tipos e recusa o resto', () => {
    for (const t of TIPOS_RESPOSTA) expect(isTipoRespostaValido(t)).toBe(true)
    expect(isTipoRespostaValido('outro')).toBe(false)
    expect(isTipoRespostaValido(null)).toBe(false)
    expect(isTipoRespostaValido(1)).toBe(false)
  })
})

describe('labelResposta', () => {
  it('a MESMA resposta se lê diferente em cada escala', () => {
    expect(labelResposta('conformidade', 'conforme')).toBe('Conforme')
    expect(labelResposta('uso_epi', 'conforme')).toBe('Está usando')
    expect(labelResposta('posse_epi', 'conforme')).toBe('Possui e em bom estado')
  })

  it('resposta pendente é rotulada como tal', () => {
    expect(labelResposta('posse_epi', null)).toBe('Pendente')
  })

  // Acontece quando o gestor troca o tipo de um item que já tinha resposta: a resposta antiga
  // segue válida no banco e precisa de rótulo honesto, não de "Desconhecido".
  it('resposta fora da escala do item ainda recebe rótulo legível', () => {
    expect(labelResposta('posse_epi', 'nao_se_aplica')).toBe('Não se aplica')
    expect(labelResposta('uso_epi', 'necessita_troca')).not.toBe('Desconhecido')
  })
})

describe('trava: rótulo não muda a nota', () => {
  it('a nota é a mesma qualquer que seja a escala do item', () => {
    const itens = [
      { peso: 1, resposta: 'conforme' as const },
      { peso: 1, resposta: 'nao_conforme' as const },
    ]
    // O cálculo nem recebe o tipo de escala — é isso que garante a invariância.
    expect(calcularNota(itens).nota).toBe(50)
  })
})
