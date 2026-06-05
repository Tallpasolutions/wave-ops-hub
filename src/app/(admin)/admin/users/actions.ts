'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const baseUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nomeCompleto: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  senhaInicial: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

const tallpaOwnerSchema = baseUserSchema.extend({
  role: z.literal('tallpa_owner'),
})

const tenantUserSchema = baseUserSchema.extend({
  role: z.enum(['tenant_owner', 'tenant_manager', 'tenant_technician']),
  tenantId: z.string().uuid('Tenant inválido'),
})

export async function createUser(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireRole(['tallpa_owner'])

  const role = formData.get('role') as string
  const isTallpaOwner = role === 'tallpa_owner'

  const schema = isTallpaOwner ? tallpaOwnerSchema : tenantUserSchema
  const result = schema.safeParse({
    email: formData.get('email'),
    nomeCompleto: formData.get('nomeCompleto'),
    senhaInicial: formData.get('senhaInicial'),
    role,
    ...(isTallpaOwner ? {} : { tenantId: formData.get('tenantId') }),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { email, nomeCompleto, senhaInicial } = result.data
  const tenantId = 'tenantId' in result.data ? result.data.tenantId : null

  const adminClient = createSupabaseAdminClient()

  // Criar usuário em auth.users via admin API
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: senhaInicial,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message?.includes('already registered') || authError.message?.includes('already been registered')) {
      return { error: 'Esse e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar usuário. Tente novamente.' }
  }

  const userId = authData.user.id

  // Inserir em public.users via adminClient — evita instanciar segundo server client
  // na mesma Server Action, o que pode disparar refresh de sessão e invalidar o cookie do criador.
  const { error: dbError } = await adminClient.from('users').insert({
    id: userId,
    email,
    nome_completo: nomeCompleto,
    role,
    tenant_id: tenantId,
    ativo: true,
  })

  if (dbError) {
    // Reverter criação em auth.users se o insert em public.users falhar
    await adminClient.auth.admin.deleteUser(userId)
    if (dbError.code === '23505') return { error: 'Esse e-mail já está em uso.' }
    return { error: 'Erro ao salvar usuário. Tente novamente.' }
  }

  redirect('/admin/users')
}

export async function toggleUserAtivo(id: string, ativo: boolean): Promise<void> {
  await requireRole(['tallpa_owner'])

  const adminClient = createSupabaseAdminClient()
  await adminClient.from('users').update({ ativo }).eq('id', id)

  revalidatePath('/admin/users')
}

export async function sendPasswordReset(email: string): Promise<void> {
  await requireRole(['tallpa_owner'])

  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  const isLocal = ROOT === 'localhost'
  const scheme = isLocal ? 'http' : 'https'
  const port = isLocal ? ':3000' : ''

  const adminClient = createSupabaseAdminClient()
  await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${scheme}://wave.${ROOT}${port}/reset-password`,
    },
  })

  revalidatePath('/admin/users')
}
