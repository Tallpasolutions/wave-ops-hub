import { describe, expect, it } from 'vitest'
import {
  TRANSICOES,
  podeTransicionar,
  isTerminal,
  podeReatribuirSupervisor,
  type StatusSupervisao,
} from '../status'

const TODOS: StatusSupervisao[] = ['agendada', 'em_execucao', 'concluida', 'cancelada']

// Matriz 4x4 explícita: cada par (de, para) declarado à mão, para que afrouxar a máquina de
// estados quebre um teste em vez de passar despercebido.
const PERMITIDAS = new Set(['agendada→em_execucao', 'agendada→cancelada', 'em_execucao→concluida', 'em_execucao→cancelada'])

describe('podeTransicionar — matriz completa', () => {
  for (const de of TODOS) {
    for (const para of TODOS) {
      const esperado = PERMITIDAS.has(`${de}→${para}`)
      it(`${de} → ${para} = ${esperado}`, () => {
        expect(podeTransicionar(de, para)).toBe(esperado)
      })
    }
  }
})

describe('estados terminais', () => {
  it('concluida e cancelada não saem do lugar', () => {
    expect(isTerminal('concluida')).toBe(true)
    expect(isTerminal('cancelada')).toBe(true)
    expect(TRANSICOES.concluida).toEqual([])
    expect(TRANSICOES.cancelada).toEqual([])
  })

  it('agendada e em_execucao não são terminais', () => {
    expect(isTerminal('agendada')).toBe(false)
    expect(isTerminal('em_execucao')).toBe(false)
  })

  it('concluída não reabre: a nota já foi congelada', () => {
    expect(podeTransicionar('concluida', 'em_execucao')).toBe(false)
    expect(podeTransicionar('concluida', 'agendada')).toBe(false)
  })

  it('não dá para pular a execução e concluir direto', () => {
    expect(podeTransicionar('agendada', 'concluida')).toBe(false)
  })
})

describe('podeReatribuirSupervisor', () => {
  // supervisor_user_id é desnormalizado em answers e photos para a RLS filtrar sem join;
  // trocá-lo depois de haver respostas exigiria atualizar tudo em sincronia.
  it('só antes de a execução começar', () => {
    expect(podeReatribuirSupervisor('agendada')).toBe(true)
    expect(podeReatribuirSupervisor('em_execucao')).toBe(false)
    expect(podeReatribuirSupervisor('concluida')).toBe(false)
    expect(podeReatribuirSupervisor('cancelada')).toBe(false)
  })
})
