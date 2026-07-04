'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayouts } from '@/lib/payouts'

const LOCKED_STATUSES = ['approved', 'paid']

// Guard da Sprint 12 Fase D: sem categoria não dá para saber se o técnico recebe —
// aprovar um motivo pendente cria pagamento indefinido (QA 02/07, item M5).
const PENDING_CLASSIFICATION = 'pending_classification'

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
  if (payout.status === PENDING_CLASSIFICATION) {
    return { error: 'Classifique o motivo antes de aprovar.' }
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

export async function rejectImprodutiva(
  payoutId: string,
  justificativa?: string,
): Promise<{ error: string | null }> {
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
    .update({
      improdutiva_aprovada: false,
      status: 'override',
      valor_override: 0,
      override_motivo: justificativa?.trim() || 'Improdutiva rejeitada na fila de aprovação',
      override_by: user.id,
      override_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)

  if (error) return { error: 'Erro ao rejeitar improdutiva. Tente novamente.' }

  revalidatePath('/improdutivas')
  return { error: null }
}

export async function bulkApproveImprodutivas(
  payoutIds: string[],
): Promise<{ error: string | null; approved: number; skippedPendentes: number }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (payoutIds.length === 0) return { error: null, approved: 0, skippedPendentes: 0 }

  const supabase = await createSupabaseServerClient()

  const { data: eligible } = await supabase
    .from('payouts')
    .select('id, status')
    .in('id', payoutIds)
    .eq('tenant_id', user.tenantId!)

  const unlocked = (eligible ?? []).filter((p) => !LOCKED_STATUSES.includes(p.status))
  const pendentes = unlocked.filter((p) => p.status === PENDING_CLASSIFICATION)
  const eligibleIds = unlocked
    .filter((p) => p.status !== PENDING_CLASSIFICATION)
    .map((p) => p.id)

  if (eligibleIds.length === 0) {
    return {
      error: pendentes.length > 0 ? 'Todas as selecionadas têm motivo pendente — classifique antes de aprovar.' : null,
      approved: 0,
      skippedPendentes: pendentes.length,
    }
  }

  const { error } = await supabase
    .from('payouts')
    .update({ improdutiva_aprovada: true, status: 'approved' })
    .in('id', eligibleIds)
    .eq('tenant_id', user.tenantId!)

  if (error) return { error: 'Erro ao aprovar improdutivas em lote.', approved: 0, skippedPendentes: pendentes.length }

  revalidatePath('/improdutivas')
  return { error: null, approved: eligibleIds.length, skippedPendentes: pendentes.length }
}

// Rejeição em lote: manda os selecionados (não travados) para override R$ 0. Diferente da
// aprovação, não bloqueia motivo pendente — rejeitar é sempre permitido.
export async function bulkRejectImprodutivas(
  payoutIds: string[],
  justificativa?: string,
): Promise<{ error: string | null; rejected: number }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Usuário sem tenant.', rejected: 0 }
  if (payoutIds.length === 0) return { error: null, rejected: 0 }

  const supabase = await createSupabaseServerClient()

  const { data: eligible } = await supabase
    .from('payouts')
    .select('id, status')
    .in('id', payoutIds)
    .eq('tenant_id', user.tenantId)

  const eligibleIds = (eligible ?? [])
    .filter((p) => !LOCKED_STATUSES.includes(p.status))
    .map((p) => p.id)

  if (eligibleIds.length === 0) return { error: null, rejected: 0 }

  const { error } = await supabase
    .from('payouts')
    .update({
      improdutiva_aprovada: false,
      status: 'override',
      valor_override: 0,
      override_motivo: justificativa?.trim() || 'Improdutiva rejeitada em lote',
      override_by: user.id,
      override_at: new Date().toISOString(),
    })
    .in('id', eligibleIds)
    .eq('tenant_id', user.tenantId)

  if (error) return { error: 'Erro ao rejeitar improdutivas em lote.', rejected: 0 }

  revalidatePath('/improdutivas')
  return { error: null, rejected: eligibleIds.length }
}

// Desfazer da última decisão (aprovação ou rejeição): limpa a decisão e o override e
// recalcula a visita para restaurar o status verdadeiro (o recálculo pula approved/paid,
// por isso o status é rebaixado para 'pending' na mesma escrita).
export async function undoImprodutivaDecision(payoutId: string): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Usuário sem tenant.' }
  const supabase = await createSupabaseServerClient()

  const { data: payout } = await supabase
    .from('payouts')
    .select('id, visit_id, improdutiva_aprovada, paid_at, closing_id')
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!payout || payout.improdutiva_aprovada === null) {
    return { error: 'Nada a desfazer para este payout.' }
  }
  if (payout.paid_at || payout.closing_id) {
    return { error: 'Payout já entrou em fechamento/pagamento — não pode ser desfeito aqui.' }
  }

  const { error } = await supabase
    .from('payouts')
    .update({
      improdutiva_aprovada: null,
      status: 'pending',
      valor_override: null,
      override_motivo: null,
      override_by: null,
      override_at: null,
    })
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId)

  if (error) return { error: 'Erro ao desfazer. Tente novamente.' }

  await recalculatePendingPayouts(user.tenantId, supabase, {
    visitIds: [payout.visit_id as string],
  })

  revalidatePath('/improdutivas')
  return { error: null }
}
