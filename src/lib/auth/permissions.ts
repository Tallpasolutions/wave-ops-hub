import { redirect } from 'next/navigation'
import { getCurrentUser } from './session'
import type { AppRole, SessionUser } from './types'

// Garante usuário autenticado com role permitida.
// Redireciona para /login se não há sessão.
// Lança erro se role não é suficiente — Next.js intercepta em Server Actions.
export async function requireRole(roles: AppRole[]): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!roles.includes(user.role)) {
    throw new Error('Forbidden')
  }

  return user
}

// Funções de permissão por domínio de negócio (conforme ADR-005)

export function canApproveClosing(user: SessionUser): boolean {
  return (
    user.role === 'tallpa_owner' ||
    user.role === 'tenant_owner' ||
    user.role === 'tenant_manager'
  )
}

export function canManageLpu(user: SessionUser): boolean {
  return (
    user.role === 'tallpa_owner' ||
    user.role === 'tenant_owner' ||
    user.role === 'tenant_manager'
  )
}

export function canManageTechnicians(user: SessionUser): boolean {
  return (
    user.role === 'tallpa_owner' ||
    user.role === 'tenant_owner' ||
    user.role === 'tenant_manager'
  )
}

// tenant_manager NÃO pode criar ou editar usuários — apenas tenant_owner e tallpa_owner
export function canManageUsers(user: SessionUser): boolean {
  return user.role === 'tallpa_owner' || user.role === 'tenant_owner'
}

export function canViewBilling(user: SessionUser): boolean {
  return user.role === 'tallpa_owner' || user.role === 'tenant_owner'
}
