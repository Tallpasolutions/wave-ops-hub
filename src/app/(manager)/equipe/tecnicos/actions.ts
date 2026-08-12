'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { adminSetUserPassword } from '@/lib/auth/set-password'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { recalculatePendingPayouts } from '@/lib/payouts'

const createTechnicianSchema = z.object({
  nomeCompleto: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  cpf: z.string().max(14).optional().or(z.literal('')),
  celular: z.string().max(20).optional().or(z.literal('')),
  codigoUnetvale: z.string().max(50).optional().or(z.literal('')),
})

export async function createTechnician(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])

  const result = createTechnicianSchema.safeParse({
    nomeCompleto: formData.get('nomeCompleto'),
    email: formData.get('email'),
    cpf: formData.get('cpf') ?? '',
    celular: formData.get('celular') ?? '',
    codigoUnetvale: formData.get('codigoUnetvale') ?? '',
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { nomeCompleto, email, cpf, celular, codigoUnetvale } = result.data
  const tenantId = currentUser.tenantId!

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase.from('technicians').insert({
    tenant_id: tenantId,
    nome_completo: nomeCompleto,
    email,
    cpf: cpf || null,
    celular: celular || null,
    codigo_unetvale: codigoUnetvale || null,
    ativo: true,
  })

  if (dbError) {
    if (dbError.code === '23505') {
      if (dbError.message?.includes('email')) return { error: 'Já existe um técnico com esse e-mail.' }
      if (dbError.message?.includes('cpf')) return { error: 'Já existe um técnico com esse CPF.' }
      if (dbError.message?.includes('codigo')) return { error: 'Já existe um técnico com esse código Unetvale.' }
      return { error: 'Dados duplicados. Verifique e-mail, CPF ou código Unetvale.' }
    }
    return { error: 'Erro ao cadastrar técnico. Tente novamente.' }
  }

  const from = formData.get('from') as string | null
  redirect(from && from.startsWith('/') ? from : '/equipe/tecnicos')
}

// ADR-014: atribui (ou remove) a LPU específica de um técnico. lpuId null = usa a
// LPU padrão ativa do tenant. Recalcula os payouts do técnico (escopo por visitIds
// para não estourar o timeout do recálculo do tenant inteiro).
export async function setTechnicianLpu(
  technicianId: string,
  lpuId: string | null,
): Promise<{ error?: string }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Usuário sem tenant.' }
  const supabase = await createSupabaseServerClient()

  if (lpuId) {
    const { data: lpu } = await supabase
      .from('lpus')
      .select('id')
      .eq('id', lpuId)
      .eq('tenant_id', user.tenantId)
      .maybeSingle()
    if (!lpu) return { error: 'LPU inválida.' }
  }

  const { error } = await supabase
    .from('technicians')
    .update({ lpu_id: lpuId })
    .eq('id', technicianId)
    .eq('tenant_id', user.tenantId)
  if (error) return { error: 'Erro ao salvar a LPU do técnico.' }

  // Recalcula os payouts pendentes do técnico com a nova LPU (approved/paid ficam
  // preservados). Escopo por visitIds do técnico.
  const { rows: visitRows } = await fetchAllPages<{ id: string }>((from, to) =>
    supabase
      .from('service_visits')
      .select('id')
      .eq('tenant_id', user.tenantId!)
      .eq('tecnico_id', technicianId)
      .eq('fora_escopo', false)
      .order('id')
      .range(from, to),
  )
  const visitIds = visitRows.map((v) => v.id)
  if (visitIds.length > 0) {
    try {
      await recalculatePendingPayouts(user.tenantId, supabase, { visitIds })
    } catch {
      // vínculo da LPU já gravado; um "Recalcular pendentes" posterior ajusta valores
    }
  }

  revalidatePath(`/equipe/tecnicos/${technicianId}`)
  return {}
}

export async function toggleTechnicianAtivo(id: string, ativo: boolean): Promise<void> {
  await requireRole(['tenant_owner', 'tenant_manager'])

  const supabase = await createSupabaseServerClient()
  await supabase.from('technicians').update({ ativo }).eq('id', id)

  revalidatePath('/equipe/tecnicos')
}

// ── Acesso do técnico ao portal (login) — mesmo fluxo de Equipe/Supervisor ──────────

const createLoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senhaInicial: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

// Cria um usuário role tenant_technician vinculado ao técnico (users.technician_id).
export async function createTechnicianLogin(
  technicianId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])
  const tenantId = currentUser.tenantId!

  const result = createLoginSchema.safeParse({
    email: formData.get('email'),
    senhaInicial: formData.get('senhaInicial'),
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { email, senhaInicial } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: tech } = await adminClient
    .from('technicians')
    .select('nome_completo')
    .eq('id', technicianId)
    .eq('tenant_id', tenantId)
    .single()
  if (!tech) return { error: 'Técnico não encontrado.' }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: senhaInicial,
    email_confirm: true,
  })
  if (authError) {
    if (authError.message?.toLowerCase().includes('already')) {
      return { error: 'Esse e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar acesso. Tente novamente.' }
  }

  const userId = authData.user.id
  const { error: dbError } = await adminClient.from('users').insert({
    id: userId,
    email,
    nome_completo: tech.nome_completo,
    role: 'tenant_technician',
    tenant_id: tenantId,
    technician_id: technicianId,
    ativo: true,
  })
  if (dbError) {
    await adminClient.auth.admin.deleteUser(userId)
    if (dbError.code === '23505') return { error: 'Esse e-mail já está em uso.' }
    return { error: 'Erro ao salvar acesso. Tente novamente.' }
  }

  revalidatePath(`/equipe/tecnicos/${technicianId}`)
  return { error: null }
}

// Bloqueia/reativa o LOGIN do técnico (users.ativo) — não mexe no flag do técnico.
export async function setTechnicianUserAtivo(
  userId: string,
  ativo: boolean,
  technicianId: string,
): Promise<void> {
  await requireRole(['tenant_owner', 'tenant_manager'])
  const adminClient = createSupabaseAdminClient()
  await adminClient.from('users').update({ ativo }).eq('id', userId)
  revalidatePath(`/equipe/tecnicos/${technicianId}`)
}

// Define a nova senha do login do técnico na própria tela, sem e-mail de recuperação.
export async function setTechnicianPassword(
  userId: string,
  technicianId: string,
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const currentUser = await requireRole(['tenant_owner', 'tenant_manager'])

  const { error } = await adminSetUserPassword({
    userId,
    tenantId: currentUser.tenantId!,
    allowedRoles: ['tenant_technician'],
    novaSenha: formData.get('novaSenha'),
    confirmarSenha: formData.get('confirmarSenha'),
  })

  if (error) return { error, success: false }

  revalidatePath(`/equipe/tecnicos/${technicianId}`)
  return { error: null, success: true }
}
