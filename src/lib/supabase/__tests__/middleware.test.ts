import { describe, expect, it } from 'vitest'
import {
  classificarErroSessao,
  isInvalidSessionError,
  isPrefetchRequest,
} from '../middleware'

// C1 do QA de 02/07/2026: "AuthApiError: Invalid Refresh Token: Already Used", com o gestor
// expulso no meio do trabalho e caindo em loop de login.
//
// A correção da Sprint 11 centralizou o refresh no middleware, mas o middleware roda uma vez
// POR REQUISIÇÃO — e o router do Next dispara várias em paralelo. A corrida continuou.
//
// Aqui estão as duas metades da correção definitiva:
//   1. "already used" é CORRIDA, não sessão morta — não pode limpar cookie.
//   2. Prefetch não renova sessão — ataca a causa da concorrência.

describe('classificarErroSessao', () => {
  // A distinção que importa: a mesma família de erro, dois significados opostos.
  it('"already used" é CORRIDA — outra requisição já renovou com sucesso', () => {
    expect(classificarErroSessao({ code: 'refresh_token_already_used', message: 'x' })).toBe(
      'corrida',
    )
    // O erro real de produção chegou só como texto, sem código.
    expect(classificarErroSessao({ message: 'Invalid Refresh Token: Already Used' })).toBe(
      'corrida',
    )
  })

  it('"not found" e "session not found" são TERMINAIS — aí limpar é o certo', () => {
    expect(classificarErroSessao({ code: 'refresh_token_not_found', message: 'x' })).toBe(
      'terminal',
    )
    expect(classificarErroSessao({ code: 'session_not_found', message: 'x' })).toBe('terminal')
    expect(classificarErroSessao({ message: 'Invalid Refresh Token: Not Found' })).toBe(
      'terminal',
    )
  })

  // O código tem precedência sobre o texto: "already used" também casa /invalid refresh
  // token/, e a ordem errada classificaria uma corrida como terminal — que é justamente o
  // bug que estamos corrigindo.
  it('o código manda quando texto e código discordam', () => {
    expect(
      classificarErroSessao({
        code: 'refresh_token_already_used',
        message: 'Invalid Refresh Token',
      }),
    ).toBe('corrida')
  })

  it('usuário simplesmente deslogado não é erro de sessão', () => {
    // AuthSessionMissingError: request sem cookies — estado normal de logout. Não pode
    // redirecionar nem limpar cookies de terceiros.
    expect(classificarErroSessao({ message: 'Auth session missing!' })).toBe('nenhum')
    expect(classificarErroSessao(null)).toBe('nenhum')
  })

  it('erro transitório de rede não é erro de sessão', () => {
    expect(classificarErroSessao({ code: 'unexpected_failure', message: 'fetch failed' })).toBe(
      'nenhum',
    )
  })
})

describe('isInvalidSessionError', () => {
  it('continua dizendo "a sessão está ruim?" para os dois casos', () => {
    expect(isInvalidSessionError({ code: 'refresh_token_already_used', message: 'x' })).toBe(true)
    expect(isInvalidSessionError({ code: 'refresh_token_not_found', message: 'x' })).toBe(true)
    expect(isInvalidSessionError({ message: 'Auth session missing!' })).toBe(false)
    expect(isInvalidSessionError(null)).toBe(false)
  })
})

describe('isPrefetchRequest', () => {
  const h = (pares: Record<string, string>) => new Headers(pares)

  it('reconhece o cabeçalho do router do Next', () => {
    expect(isPrefetchRequest(h({ 'next-router-prefetch': '1' }))).toBe(true)
  })

  it('reconhece o cabeçalho padrão do navegador', () => {
    expect(isPrefetchRequest(h({ purpose: 'prefetch' }))).toBe(true)
    expect(isPrefetchRequest(h({ Purpose: 'Prefetch' }))).toBe(true)
    expect(isPrefetchRequest(h({ 'x-purpose': 'prefetch' }))).toBe(true)
  })

  // A navegação de verdade PRECISA renovar. Classificar errado aqui deixaria a sessão
  // expirar sem nunca ser renovada — pior que o bug original.
  it('navegação normal NÃO é prefetch', () => {
    expect(isPrefetchRequest(h({}))).toBe(false)
    expect(isPrefetchRequest(h({ 'next-router-prefetch': '0' }))).toBe(false)
    expect(isPrefetchRequest(h({ purpose: 'navigate' }))).toBe(false)
    expect(isPrefetchRequest(h({ accept: 'text/html' }))).toBe(false)
  })
})
