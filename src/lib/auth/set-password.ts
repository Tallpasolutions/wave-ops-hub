import 'server-only'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { AppRole } from './types'

export const setPasswordSchema = z
  .object({
    novaSenha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(72),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })

type Params = {
  userId: string
  tenantId: string
  allowedRoles: AppRole[]
  novaSenha: unknown
  confirmarSenha: unknown
}

// Define a senha de outro usuário do mesmo tenant via service role. O escopo por
// tenant_id + role é o que impede um tenant_owner de trocar a senha de alguém de
// fora da sua operação — a role do chamador é checada por requireRole na Action.
export async function adminSetUserPassword({
  userId,
  tenantId,
  allowedRoles,
  novaSenha,
  confirmarSenha,
}: Params): Promise<{ error: string | null }> {
  const parsed = setPasswordSchema.safeParse({ novaSenha, confirmarSenha })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' }
  }

  const adminClient = createSupabaseAdminClient()

  const { data: target, error: lookupError } = await adminClient
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (lookupError) return { error: 'Erro ao localizar o usuário. Tente novamente.' }
  if (!target || !allowedRoles.includes(target.role as AppRole)) {
    return { error: 'Usuário não encontrado nesta operação.' }
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: parsed.data.novaSenha,
  })

  if (error) {
    if (error.message?.toLowerCase().includes('password')) {
      return { error: 'Senha recusada pelo servidor. Use uma senha mais forte.' }
    }
    return { error: 'Erro ao definir a senha. Tente novamente.' }
  }

  return { error: null }
}
