import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import type { AppRole, SessionUser } from '@/lib/auth/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSupervisaoCampoOn } from '@/lib/tenant/features'

// Gate único do módulo Supervisão de Campo (ADR-022): papel E feature flag.
//
// PRIMEIRA LINHA de toda page e de toda Server Action do módulo. Sem isso, com a flag
// desligada, a rota continuaria respondendo para quem digitasse a URL e a action continuaria
// executável — esconder só o item de menu não é gate.
//
// Com a flag desligada devolve 404 (notFound), não 403: 403 confirmaria que o módulo existe
// e está apenas desligado para este tenant. 404 não revela nada.
//
// A flag é lida do banco a cada request, não do JWT — ligar ou desligar vale na hora, sem
// depender do refresh do token.
export async function requireSupervisaoCampo(roles: AppRole[]): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  if (!roles.includes(user.role)) {
    // REDIRECIONA, não lança. `requireRole` lança 'Forbidden', que o Next renderiza como tela
    // de erro — e isso acontece de verdade aqui: o layout de (technician) aceita técnico E
    // supervisor, então o técnico comum ALCANÇA estas rotas antes de qualquer checagem.
    // Mandar para o painel dele é o que /minha-equipe já faz.
    redirect(roles.includes('tenant_supervisor') ? '/' : '/login')
  }

  // tallpa_owner não tem tenant_id: opera a plataforma e enxerga todos os tenants, então não
  // há flag de tenant a consultar.
  if (!user.tenantId) return user

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', user.tenantId)
    .single()

  if (!isSupervisaoCampoOn(data?.config)) notFound()

  return user
}

// Papéis que enxergam o módulo, por portal. O técnico comum NÃO está em nenhum dos dois:
// ele não vê a própria supervisão (ADR-022 D5), e isso também está gravado na RLS.
export const SUPERVISAO_ROLES_GESTOR: AppRole[] = [
  'tallpa_owner',
  'tenant_owner',
  'tenant_manager',
]

export const SUPERVISAO_ROLES_SUPERVISOR: AppRole[] = ['tenant_supervisor']
