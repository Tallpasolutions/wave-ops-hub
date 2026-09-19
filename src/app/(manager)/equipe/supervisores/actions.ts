'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ADR-023: supervisor NÃO é obrigatoriamente um técnico. `technicianId` só é preenchido
// quando ele também executa visitas — e aí o portal dele mostra painel, visitas, IQI e
// histórico próprios. Sem vínculo, ele é supervisor puro.
//
// Não confundir com `supervisedIds`, que é a equipe pela qual ele responde
// (tabela supervisor_technicians) — essa continua sendo o coração do cadastro.
//
// `nomeCompleto` passa a vir do formulário: antes era copiado do técnico vinculado, o que
// deixa de existir quando não há vínculo.
const createSupervisorSchema = z.object({
  technicianId: z
    .string()
    .uuid('Técnico inválido')
    .optional()
    .or(z.literal('')),
  nomeCompleto: z.string().trim().min(3, 'Informe o nome completo do supervisor'),
  email: z.string().email('E-mail inválido'),
  senhaInicial: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  supervisedIds: z.array(z.string().uuid()),
})

export async function createSupervisor(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])

  const supervisedIds = formData.getAll('supervisedIds').map(String)

  const result = createSupervisorSchema.safeParse({
    technicianId: formData.get('technicianId'),
    nomeCompleto: formData.get('nomeCompleto'),
    email: formData.get('email'),
    senhaInicial: formData.get('senhaInicial'),
    supervisedIds,
  })

  if (!result.success) return { error: result.error.errors[0].message }

  const {
    technicianId: technicianIdRaw,
    nomeCompleto,
    email,
    senhaInicial,
    supervisedIds: supervised,
  } = result.data
  const tenantId = currentUser.tenantId!
  const adminClient = createSupabaseAdminClient()

  // String vazia do <select> vira null: a coluna aceita nulo para supervisor (migration 0043).
  const technicianId = technicianIdRaw ? technicianIdRaw : null

  // Só valida o técnico quando há vínculo. Sem vínculo, nada a checar.
  if (technicianId) {
    const { data: existingTech } = await adminClient
      .from('technicians')
      .select('id')
      .eq('id', technicianId)
      .eq('tenant_id', tenantId)
      .single()

    if (!existingTech) return { error: 'Técnico não encontrado.' }
  }

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
    role: 'tenant_supervisor',
    tenant_id: tenantId,
    technician_id: technicianId,
    ativo: true,
  })

  if (dbError) {
    await adminClient.auth.admin.deleteUser(userId)
    if (dbError.code === '23505') return { error: 'Esse e-mail já está em uso.' }
    return { error: 'Erro ao salvar usuário. Tente novamente.' }
  }

  if (supervised.length > 0) {
    await adminClient.from('supervisor_technicians').insert(
      supervised.map((tid) => ({
        tenant_id: tenantId,
        supervisor_id: userId,
        technician_id: tid,
      })),
    )
  }

  redirect('/equipe/supervisores')
}

export async function addTechnicianToSupervisor(
  supervisorUserId: string,
  technicianId: string,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('supervisor_technicians').insert({
    tenant_id: currentUser.tenantId!,
    supervisor_id: supervisorUserId,
    technician_id: technicianId,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Técnico já está na equipe deste supervisor.' }
    return { error: 'Erro ao adicionar técnico.' }
  }

  revalidatePath(`/equipe/supervisores/${supervisorUserId}`)
  return { error: null }
}

export async function removeTechnicianFromSupervisor(
  supervisorUserId: string,
  technicianId: string,
): Promise<void> {
  await requireRole(['tenant_owner', 'tenant_manager'])

  const adminClient = createSupabaseAdminClient()
  await adminClient
    .from('supervisor_technicians')
    .delete()
    .eq('supervisor_id', supervisorUserId)
    .eq('technician_id', technicianId)

  revalidatePath(`/equipe/supervisores/${supervisorUserId}`)
}
