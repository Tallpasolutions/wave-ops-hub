import { describe, expect, it } from 'vitest'
import {
  TRANSICOES,
  podeTransicionar,
  isTerminal,
  estaEmAndamento,
  podeReatribuirSupervisor,
  proximaAcao,
  type StatusSupervisao,
} from '../status'

// TODOS é derivado de TRANSICOES, não escrito à mão: estado novo entra na matriz
// automaticamente, e não dá para acrescentar um sem que este teste o cubra. A versão
// anterior tinha a lista fixa e passou verde quando 'em_deslocamento' foi criado — confiança
// falsa, que é pior que teste faltando.
const TODOS = Object.keys(TRANSICOES) as StatusSupervisao[]

// Cada par permitido, declarado à mão: afrouxar a máquina quebra um teste em vez de passar
// despercebido.
const PERMITIDAS = new Set([
  'agendada→em_deslocamento',
  'agendada→em_execucao',
  'agendada→cancelada',
  'em_deslocamento→em_execucao',
  'em_deslocamento→cancelada',
  'em_execucao→concluida',
  'em_execucao→cancelada',
])

describe('podeTransicionar — matriz completa', () => {
  it('cobre os 5 estados', () => {
    expect(TODOS).toHaveLength(5)
  })

  for (const de of TODOS) {
    for (const para of TODOS) {
      const esperado = PERMITIDAS.has(`${de}→${para}`)
      it(`${de} → ${para} = ${esperado}`, () => {
        expect(podeTransicionar(de, para)).toBe(esperado)
      })
    }
  }
})

describe('fluxo do supervisor em campo', () => {
  it('o caminho completo é agendada → deslocamento → execução → concluída', () => {
    expect(podeTransicionar('agendada', 'em_deslocamento')).toBe(true)
    expect(podeTransicionar('em_deslocamento', 'em_execucao')).toBe(true)
    expect(podeTransicionar('em_execucao', 'concluida')).toBe(true)
  })

  // Quem já está no local, ou esqueceu de marcar a saída, precisa conseguir começar.
  it('o deslocamento pode ser pulado', () => {
    expect(podeTransicionar('agendada', 'em_execucao')).toBe(true)
  })

  it('não dá para voltar um passo', () => {
    expect(podeTransicionar('em_execucao', 'em_deslocamento')).toBe(false)
    expect(podeTransicionar('em_deslocamento', 'agendada')).toBe(false)
  })

  it('não dá para concluir sem passar pela execução', () => {
    expect(podeTransicionar('agendada', 'concluida')).toBe(false)
    expect(podeTransicionar('em_deslocamento', 'concluida')).toBe(false)
  })

  it('cancelar vale em qualquer estado não terminal', () => {
    expect(podeTransicionar('agendada', 'cancelada')).toBe(true)
    expect(podeTransicionar('em_deslocamento', 'cancelada')).toBe(true)
    expect(podeTransicionar('em_execucao', 'cancelada')).toBe(true)
  })
})

describe('estados terminais', () => {
  it('concluída e cancelada não saem do lugar', () => {
    expect(isTerminal('concluida')).toBe(true)
    expect(isTerminal('cancelada')).toBe(true)
    expect(TRANSICOES.concluida).toEqual([])
    expect(TRANSICOES.cancelada).toEqual([])
  })

  it('os demais não são terminais', () => {
    expect(isTerminal('agendada')).toBe(false)
    expect(isTerminal('em_deslocamento')).toBe(false)
    expect(isTerminal('em_execucao')).toBe(false)
  })

  it('concluída não reabre: a nota já foi congelada', () => {
    for (const para of TODOS) expect(podeTransicionar('concluida', para)).toBe(false)
  })

  it('cancelada não reabre', () => {
    for (const para of TODOS) expect(podeTransicionar('cancelada', para)).toBe(false)
  })
})

describe('estaEmAndamento', () => {
  // É o que o gestor quer ver destacado na agenda do dia.
  it('só deslocamento e execução contam como acontecendo agora', () => {
    expect(estaEmAndamento('em_deslocamento')).toBe(true)
    expect(estaEmAndamento('em_execucao')).toBe(true)
    expect(estaEmAndamento('agendada')).toBe(false)
    expect(estaEmAndamento('concluida')).toBe(false)
    expect(estaEmAndamento('cancelada')).toBe(false)
  })
})

describe('podeReatribuirSupervisor', () => {
  // supervisor_user_id é desnormalizado nas respostas e fotos; trocar depois de a vistoria
  // começar exigiria migrar tudo em sincronia.
  it('vale até a vistoria começar', () => {
    expect(podeReatribuirSupervisor('agendada')).toBe(true)
    expect(podeReatribuirSupervisor('em_deslocamento')).toBe(true)
    expect(podeReatribuirSupervisor('em_execucao')).toBe(false)
    expect(podeReatribuirSupervisor('concluida')).toBe(false)
    expect(podeReatribuirSupervisor('cancelada')).toBe(false)
  })
})

describe('proximaAcao', () => {
  it('cada estado oferece a ação seguinte, em português', () => {
    expect(proximaAcao('agendada')).toEqual({
      label: 'Iniciar deslocamento',
      proximoStatus: 'em_deslocamento',
    })
    expect(proximaAcao('em_deslocamento')).toEqual({
      label: 'Iniciar vistoria',
      proximoStatus: 'em_execucao',
    })
    expect(proximaAcao('em_execucao')).toEqual({
      label: 'Finalizar vistoria',
      proximoStatus: 'concluida',
    })
  })

  it('estado terminal não oferece ação', () => {
    expect(proximaAcao('concluida')).toBeNull()
    expect(proximaAcao('cancelada')).toBeNull()
  })

  // A ação oferecida tem que ser uma transição legal — senão o botão existiria e falharia.
  it('toda ação oferecida é uma transição válida', () => {
    for (const status of TODOS) {
      const acao = proximaAcao(status)
      if (acao) expect(podeTransicionar(status, acao.proximoStatus), status).toBe(true)
    }
  })
})
