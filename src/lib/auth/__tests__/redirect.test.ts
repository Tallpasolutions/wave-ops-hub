import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildPostLoginUrl } from '../redirect'
import type { AppRole } from '../types'

// Regressão de acesso: o destino pós-login tem que casar com o portal que aceita cada papel.
// Quando não casa, o layout recusa e manda de volta para /login — e o usuário fica num laço
// infinito, sem nenhuma mensagem de erro. Foi o que aconteceu com tenant_supervisor: o papel
// nasceu na migration 0009 e esta função nunca foi atualizada, então ele caía no destino do
// gestor, era recusado, e nunca conseguia entrar.
//
// Quem aceita quem (as fontes são os layouts):
//   (admin)/admin/layout.tsx  -> tallpa_owner
//   (manager)/layout.tsx      -> tallpa_owner, tenant_owner, tenant_manager
//   (technician)/layout.tsx   -> tenant_technician, tenant_supervisor

const PORTAL_TECNICO = ['tenant_technician', 'tenant_supervisor'] as const
const PORTAL_GESTOR = ['tenant_owner', 'tenant_manager'] as const
const TODOS: AppRole[] = [
  'tallpa_owner',
  'tenant_owner',
  'tenant_manager',
  'tenant_technician',
  'tenant_supervisor',
]

describe('buildPostLoginUrl', () => {
  const rootAnterior = process.env.NEXT_PUBLIC_ROOT_DOMAIN

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN // default = localhost
  })
  afterEach(() => {
    if (rootAnterior === undefined) delete process.env.NEXT_PUBLIC_ROOT_DOMAIN
    else process.env.NEXT_PUBLIC_ROOT_DOMAIN = rootAnterior
  })

  it('tallpa_owner vai para o portal Tallpa', () => {
    expect(buildPostLoginUrl('tallpa_owner', 'wave')).toBe(
      'http://admin.localhost:3000/admin/dashboard',
    )
  })

  for (const role of PORTAL_TECNICO) {
    it(`${role} vai para o portal do TÉCNICO`, () => {
      expect(buildPostLoginUrl(role, 'wave')).toBe('http://wave.localhost:3000/profile')
    })
  }

  for (const role of PORTAL_GESTOR) {
    it(`${role} vai para o portal do GESTOR`, () => {
      expect(buildPostLoginUrl(role, 'wave')).toBe('http://wave.localhost:3000/dashboard')
    })
  }

  // A trava principal: nenhum papel do portal do técnico pode ser mandado para /dashboard,
  // que é onde (manager)/layout.tsx recusa e devolve para /login.
  it('nenhum papel do portal do técnico é mandado para /dashboard', () => {
    const errados = PORTAL_TECNICO.filter((r) => buildPostLoginUrl(r, 'wave').endsWith('/dashboard'))
    expect(errados).toEqual([])
  })

  it('todo papel tem destino, e nenhum destino é o próprio /login', () => {
    for (const role of TODOS) {
      const url = buildPostLoginUrl(role, 'wave')
      expect(url, role).toMatch(/^https?:\/\/[^/]+\/.+/)
      expect(url, role).not.toContain('/login')
    }
  })

  it('em produção usa https, sem porta, e respeita o subdomínio do tenant', () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'tallpa.com.br'
    expect(buildPostLoginUrl('tenant_supervisor', 'wave')).toBe('https://wave.tallpa.com.br/profile')
    expect(buildPostLoginUrl('tenant_manager', 'scooby')).toBe(
      'https://scooby.tallpa.com.br/dashboard',
    )
    expect(buildPostLoginUrl('tallpa_owner', 'wave')).toBe(
      'https://admin.tallpa.com.br/admin/dashboard',
    )
  })
})
