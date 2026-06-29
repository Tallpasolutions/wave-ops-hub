'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { calcPrioridade, createLpuRuleSchema } from '@/lib/lpu'

// ── Create LPU ──────────────────────────────────────────────────────────────

const createLpuSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(200),
  vigenciaInicio: z.string().min(1, 'Data de início é obrigatória'),
  vigenciaFim: z.string().optional().or(z.literal('')),
})

export async function createLpu(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const result = createLpuSchema.safeParse({
    nome: formData.get('nome'),
    vigenciaInicio: formData.get('vigenciaInicio'),
    vigenciaFim: formData.get('vigenciaFim') ?? '',
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { nome, vigenciaInicio, vigenciaFim } = result.data
  const supabase = await createSupabaseServerClient()

  const { data: lpu, error: dbError } = await supabase
    .from('lpus')
    .insert({
      tenant_id: user.tenantId!,
      nome,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim || null,
      ativa: false,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (dbError || !lpu) return { error: 'Erro ao criar LPU. Tente novamente.' }

  redirect(`/lpu/${lpu.id}`)
}

// ── Activate LPU ────────────────────────────────────────────────────────────

export async function activateLpu(lpuId: string, _formData: FormData): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: lpu } = await supabase
    .from('lpus')
    .select('vigencia_inicio')
    .eq('id', lpuId)
    .single()

  if (!lpu) return

  // Desativa LPU(s) ativas antes — trigger rejeita duas ativas ao mesmo tempo
  await supabase
    .from('lpus')
    .update({ ativa: false, vigencia_fim: lpu.vigencia_inicio })
    .eq('tenant_id', user.tenantId!)
    .eq('ativa', true)
    .neq('id', lpuId)

  await supabase.from('lpus').update({ ativa: true }).eq('id', lpuId)

  // Recalcula todos os payouts pendentes com as novas regras
  const { recalculatePendingPayouts } = await import('@/lib/payouts')
  await recalculatePendingPayouts(user.tenantId!, supabase)

  revalidatePath('/lpu')
  revalidatePath(`/lpu/${lpuId}`)
}

// ── Create Rule ──────────────────────────────────────────────────────────────

export async function createLpuRule(
  lpuId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  let conditions: unknown
  let payout: unknown
  try {
    conditions = JSON.parse(formData.get('conditions') as string)
    payout = JSON.parse(formData.get('payout') as string)
  } catch {
    return { error: 'Dados de condição ou payout inválidos.' }
  }

  const prioridadeRaw = formData.get('prioridade')
  const prioridade = prioridadeRaw
    ? Number(prioridadeRaw)
    : calcPrioridade(conditions as Record<string, unknown>)

  const result = createLpuRuleSchema.safeParse({
    conditions,
    payout,
    description: formData.get('description'),
    prioridade,
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase.from('lpu_rules').insert({
    lpu_id: lpuId,
    prioridade: result.data.prioridade ?? calcPrioridade(conditions as Record<string, unknown>),
    conditions: result.data.conditions,
    payout: result.data.payout,
    description: result.data.description,
    ativa: true,
  })

  if (dbError) return { error: 'Erro ao criar regra. Tente novamente.' }

  revalidatePath(`/lpu/${lpuId}`)
  redirect(`/lpu/${lpuId}`)
}

// ── Update Rule ──────────────────────────────────────────────────────────────

export async function updateLpuRule(
  ruleId: string,
  lpuId: string,
  _prevState: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  let conditions: unknown
  let payout: unknown
  try {
    conditions = JSON.parse(formData.get('conditions') as string)
    payout = JSON.parse(formData.get('payout') as string)
  } catch {
    return { error: 'Dados inválidos. Verifique as condições e o payout.' }
  }

  const prioridadeRaw = formData.get('prioridade')
  const prioridade = prioridadeRaw
    ? Number(prioridadeRaw)
    : calcPrioridade(conditions as Record<string, unknown>)

  const result = createLpuRuleSchema.safeParse({
    conditions,
    payout,
    description: formData.get('description'),
    prioridade,
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase
    .from('lpu_rules')
    .update({
      conditions: result.data.conditions,
      payout: result.data.payout,
      description: result.data.description,
      prioridade: result.data.prioridade ?? calcPrioridade(conditions as Record<string, unknown>),
    })
    .eq('id', ruleId)

  if (dbError) return { error: 'Erro ao atualizar regra. Tente novamente.' }

  revalidatePath(`/lpu/${lpuId}`)
  revalidatePath(`/lpu/${lpuId}/rules/${ruleId}/edit`)
  return { error: null, success: true }
}

// ── Deactivate Rule ──────────────────────────────────────────────────────────

export async function deactivateLpuRule(ruleId: string, lpuId: string): Promise<void> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()
  await supabase.from('lpu_rules').update({ ativa: false }).eq('id', ruleId)
  revalidatePath(`/lpu/${lpuId}`)
  redirect(`/lpu/${lpuId}`)
}

// ── Distinct field values for combobox suggestions ───────────────────────────

export async function getDistinctValues(
  tenantId: string,
  field: 'finalidade' | 'cidade',
): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('service_visits')
    .select(field)
    .eq('tenant_id', tenantId)
    .not(field, 'is', null)
    .order(field)
  const seen = new Set<string>()
  return (data ?? [])
    .map((r) => (r as Record<string, string | null>)[field])
    .filter((v): v is string => {
      if (!v || seen.has(v)) return false
      seen.add(v)
      return true
    })
}

// ── Duplicate Rule ────────────────────────────────────────────────────────────

export async function duplicateLpuRule(ruleId: string, lpuId: string): Promise<void> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: original } = await supabase
    .from('lpu_rules')
    .select('*')
    .eq('id', ruleId)
    .single()

  if (!original) redirect(`/lpu/${lpuId}`)

  const { data: copy } = await supabase
    .from('lpu_rules')
    .insert({
      lpu_id: lpuId,
      prioridade: original.prioridade,
      conditions: original.conditions,
      payout: original.payout,
      description: `${original.description} (cópia)`,
      ativa: true,
    })
    .select('id')
    .single()

  if (copy) redirect(`/lpu/${lpuId}/rules/${copy.id}/edit`)
  redirect(`/lpu/${lpuId}`)
}
