'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const LOCKED_STATUSES = ['approved', 'paid']

export async function approveImprodutiva(payoutId: string): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: payout } = await supabase
    .from('payouts')
    .select('id, status')
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!payout || LOCKED_STATUSES.includes(payout.status)) {
    return { error: 'Payout não encontrado ou já fechado.' }
  }

  const { error } = await supabase
    .from('payouts')
    .update({ improdutiva_aprovada: true, status: 'approved' })
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)

  if (error) return { error: 'Erro ao aprovar improdutiva. Tente novamente.' }

  revalidatePath('/improdutivas')
  return { error: null }
}

export async function rejectImprodutiva(payoutId: string): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: payout } = await supabase
    .from('payouts')
    .select('id, status')
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!payout || LOCKED_STATUSES.includes(payout.status)) {
    return { error: 'Payout não encontrado ou já fechado.' }
  }

  const { error } = await supabase
    .from('payouts')
    .update({ improdutiva_aprovada: false, status: 'override', valor_override: 0 })
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)

  if (error) return { error: 'Erro ao rejeitar improdutiva. Tente novamente.' }

  revalidatePath('/improdutivas')
  return { error: null }
}

export async function bulkApproveImprodutivas(
  payoutIds: string[],
): Promise<{ error: string | null; approved: number }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (payoutIds.length === 0) return { error: null, approved: 0 }

  const supabase = await createSupabaseServerClient()

  const { data: eligible } = await supabase
    .from('payouts')
    .select('id, status')
    .in('id', payoutIds)
    .eq('tenant_id', user.tenantId!)

  const eligibleIds = (eligible ?? [])
    .filter((p) => !LOCKED_STATUSES.includes(p.status))
    .map((p) => p.id)

  if (eligibleIds.length === 0) return { error: null, approved: 0 }

  const { error } = await supabase
    .from('payouts')
    .update({ improdutiva_aprovada: true, status: 'approved' })
    .in('id', eligibleIds)
    .eq('tenant_id', user.tenantId!)

  if (error) return { error: 'Erro ao aprovar improdutivas em lote.', approved: 0 }

  revalidatePath('/improdutivas')
  return { error: null, approved: eligibleIds.length }
}
