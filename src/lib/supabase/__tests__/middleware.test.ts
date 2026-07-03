import { describe, expect, it } from 'vitest'
import { isInvalidSessionError } from '../middleware'

// C1 do QA de 02/07/2026: o erro real registrado no console de produção foi
// "AuthApiError: Invalid Refresh Token: Already Used" — precisa ser classificado
// como sessão irrecuperável (limpar cookies + /login?expired=1).
describe('isInvalidSessionError', () => {
  it('classifica o erro real de produção pelo texto', () => {
    expect(isInvalidSessionError({ message: 'Invalid Refresh Token: Already Used' })).toBe(true)
  })

  it('classifica pelos códigos do GoTrue', () => {
    expect(isInvalidSessionError({ code: 'refresh_token_already_used', message: 'x' })).toBe(true)
    expect(isInvalidSessionError({ code: 'refresh_token_not_found', message: 'x' })).toBe(true)
    expect(isInvalidSessionError({ code: 'session_not_found', message: 'x' })).toBe(true)
  })

  it('não classifica usuário simplesmente deslogado como sessão inválida', () => {
    // AuthSessionMissingError: request sem cookies de sessão — estado normal de logout,
    // não pode redirecionar (os layouts guardam as rotas) nem limpar cookies de terceiros.
    expect(isInvalidSessionError({ message: 'Auth session missing!' })).toBe(false)
    expect(isInvalidSessionError(null)).toBe(false)
  })

  it('não classifica erros transitórios de rede/servidor', () => {
    expect(isInvalidSessionError({ code: 'unexpected_failure', message: 'fetch failed' })).toBe(false)
  })
})
