'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { adminSetUserPassword } from '@/lib/auth/set-password'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const createManagerUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nomeCompleto: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  role: z.enum(['tenant_owner', 'tenant_manager']),
  senhaInicial: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export async function createManagerUser(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner'])

  const result = createManagerUserSchema.safeParse({
    email: formData.get('email'),
    nomeCompleto: formData.get('nomeCompleto'),
    role: formData.get('role'),
    senhaInicial: formData.get('senhaInicial'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { email, nomeCompleto, role, senhaInicial } = result.data
  const tenantId = currentUser.tenantId!

  const adminClient = createSupabaseAdminClient()

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: senhaInicial,
    email_confirm: true,
  })

  if (authError) {
    if (
      authError.message?.includes('already registered') ||
      authError.message?.includes('already been registered')
    ) {
      return { error: 'Esse e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar usuário. Tente novamente.' }
  }

  const userId = authData.user.id

  const { error: dbError } = await adminClient.from('users').insert({
    id: userId,
    email,
    nome_completo: nomeCompleto,
    role,
    tenant_id: tenantId,
    ativo: true,
  })

  if (dbError) {
    await adminClient.auth.admin.deleteUser(userId)
    if (dbError.code === '23505') return { error: 'Esse e-mail já está em uso.' }
    return { error: 'Erro ao salvar usuário. Tente novamente.' }
  }

  redirect('/equipe')
}

export async function toggleUserAtivo(id: string, ativo: boolean): Promise<void> {
  await requireRole(['tenant_owner'])

  const adminClient = createSupabaseAdminClient()
  await adminClient.from('users').update({ ativo }).eq('id', id)

  revalidatePath('/equipe')
}

// Define a nova senha do gestor na própria tela, sem passar por e-mail de recuperação.
export async function setManagerUserPassword(
  userId: string,
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const currentUser = await requireRole(['tenant_owner'])

  const { error } = await adminSetUserPassword({
    userId,
    tenantId: currentUser.tenantId!,
    allowedRoles: ['tenant_owner', 'tenant_manager'],
    novaSenha: formData.get('novaSenha'),
    confirmarSenha: formData.get('confirmarSenha'),
  })

  if (error) return { error, success: false }

  revalidatePath('/equipe')
  return { error: null, success: true }
}
