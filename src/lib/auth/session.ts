import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SessionUser } from './types'

// INTENCIONALMENTE não exportamos getSession().
// Em Server Components, sempre use getCurrentUser() que valida via supabase.auth.getUser().
// getSession() apenas lê do cookie sem validar — vulnerabilidade em Server-Side.
// Referência: https://supabase.com/docs/guides/auth/server-side/nextjs

// React.cache() deduplica chamadas dentro do mesmo request — getCurrentUser() roda uma vez,
// não importa quantos Server Components o chamem na mesma árvore de renderização.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient()

  // getUser() valida o JWT contra o servidor de auth do Supabase.
  // NUNCA usar getSession() em Server Components — apenas lê do cookie sem validar.
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) return null

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, nome_completo, role, tenant_id, technician_id, ativo')
    .eq('id', authUser.id)
    .single()
  if (error || !user) return null

  // Usuário desativado não tem acesso — verificação em app além do RLS
  if (!user.ativo) return null

  return {
    id: user.id as string,
    email: user.email as string,
    role: user.role as SessionUser['role'],
    tenantId: user.tenant_id as string | null,
    technicianId: user.technician_id as string | null,
    nomeCompleto: user.nome_completo as string,
    ativo: user.ativo as boolean,
  }
})

export const getUserRole = cache(async () => {
  const user = await getCurrentUser()
  return user?.role ?? null
})
