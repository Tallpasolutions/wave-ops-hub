'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { validateClosingReadiness, buildClosingTotals } from '@/lib/payouts'

export async function solicitarAprovacao(periodo: string, _formData: FormData) {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: payouts } = await supabase
    .from('payouts')
    .select(
      `id, status, valor_calculado, valor_override,
       service_visits(technician_id)`,
    )
    .eq('tenant_id', user.tenantId!)
    .gte('service_visits.data_execucao' as never, `${periodo}-01`)
    .lt(
      'service_visits.data_execucao' as never,
      (() => {
        const [y, m] = periodo.split('-').map(Number)
        return new Date(y, m, 1).toISOString().slice(0, 10)
      })(),
    )

  const payoutsForPeriod = (payouts ?? []).map((p) => ({
    id: p.id,
    status: p.status as import('@/lib/payouts').DbPayoutStatus,
    valorCalculado: p.valor_calculado,
    valorOverride: p.valor_override,
  }))

  const visitsWithoutTech = (payouts ?? []).filter((p) => {
    const sv = p.service_visits as unknown as { technician_id: string | null } | null
    return !sv?.technician_id
  }).length

  const validation = validateClosingReadiness(payoutsForPeriod, visitsWithoutTech)

  if (!validation.valid) {
    const b = validation.blockers
    const msgs: string[] = []
    if (b.noRuleMatch > 0) msgs.push(`${b.noRuleMatch} sem regra LPU`)
    if (b.pendingClassification > 0) msgs.push(`${b.pendingClassification} com motivo pendente`)
    if (b.conflict > 0) msgs.push(`${b.conflict} com conflito de prioridade`)
    if (b.semTecnico > 0) msgs.push(`${b.semTecnico} sem técnico vinculado`)
    redirect(`/fechamento/${periodo}?error=${encodeURIComponent(msgs.join('; '))}`)
  }

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id')
    .eq('tenant_id', user.tenantId!)
    .eq('periodo', periodo)
    .single()

  if (!closing) {
    redirect(`/fechamento/${periodo}?error=Fechamento+não+encontrado`)
  }

  await supabase
    .from('monthly_closings')
    .update({ status: 'aguardando_aprovacao' })
    .eq('id', closing.id)

  const visitIds = (payouts ?? []).map((p) => p.id)
  if (visitIds.length > 0) {
    await supabase
      .from('payouts')
      .update({ status: 'pending' })
      .in('id', visitIds)
      .not('status', 'in', '("approved","paid")')
  }

  revalidatePath(`/fechamento/${periodo}`)
  revalidatePath('/fechamento')
  redirect(`/fechamento/${periodo}`)
}

export async function aprovarFechamento(
  closingId: string,
  _formData: FormData,
) {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id, periodo, tenant_id')
    .eq('id', closingId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!closing) redirect('/fechamento')

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, status, valor_calculado, valor_override, technician_id')
    .eq('tenant_id', user.tenantId!)
    .or(`closing_id.eq.${closingId},status.eq.pending`)

  const payoutsForTotals = (payouts ?? []).map((p) => ({
    id: p.id,
    status: p.status as import('@/lib/payouts').DbPayoutStatus,
    valorCalculado: p.valor_calculado,
    valorOverride: p.valor_override,
  }))

  const totals = buildClosingTotals(payoutsForTotals, [])

  const now = new Date().toISOString()

  await supabase
    .from('monthly_closings')
    .update({
      status: 'aprovado',
      aprovado_por: user.id,
      aprovado_em: now,
      total_a_pagar: totals.totalAPagar,
      total_visitas: totals.totalVisitas,
    })
    .eq('id', closingId)

  const payoutIds = (payouts ?? []).map((p) => p.id)
  if (payoutIds.length > 0) {
    await supabase
      .from('payouts')
      .update({
        status: 'approved',
        closing_id: closingId,
        approved_by: user.id,
        approved_at: now,
      })
      .in('id', payoutIds)
      .not('status', 'in', '("paid")')
  }

  const techIds = [...new Set((payouts ?? []).map((p) => p.technician_id).filter(Boolean))]
  if (techIds.length > 0) {
    const notifications = techIds.map((techId) => ({
      tenant_id: user.tenantId!,
      user_id: techId as string,
      type: 'payout_approved',
      title: 'Payout aprovado',
      body: `Seu payout do período ${closing.periodo} foi aprovado.`,
      link: `/profile`,
    }))
    await supabase.from('notifications').insert(notifications)
  }

  revalidatePath(`/fechamento/${closing.periodo}`)
  revalidatePath('/fechamento')
  redirect(`/fechamento/${closing.periodo}`)
}

export async function marcarComoPago(closingId: string, _formData: FormData) {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id, periodo, tenant_id')
    .eq('id', closingId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!closing) redirect('/fechamento')

  const now = new Date().toISOString()

  await supabase
    .from('monthly_closings')
    .update({ status: 'pago', pago_em: now })
    .eq('id', closingId)

  const { data: payouts } = await supabase
    .from('payouts')
    .select('id, technician_id')
    .eq('closing_id', closingId)
    .eq('status', 'approved')

  const payoutIds = (payouts ?? []).map((p) => p.id)
  if (payoutIds.length > 0) {
    await supabase
      .from('payouts')
      .update({ status: 'paid', paid_at: now })
      .in('id', payoutIds)
  }

  const techIds = [...new Set((payouts ?? []).map((p) => p.technician_id).filter(Boolean))]
  if (techIds.length > 0) {
    const notifications = techIds.map((techId) => ({
      tenant_id: user.tenantId!,
      user_id: techId as string,
      type: 'payout_paid',
      title: 'Pagamento realizado',
      body: `Seu payout do período ${closing.periodo} foi marcado como pago.`,
      link: `/profile`,
    }))
    await supabase.from('notifications').insert(notifications)
  }

  revalidatePath(`/fechamento/${closing.periodo}`)
  revalidatePath('/fechamento')
  redirect(`/fechamento/${closing.periodo}`)
}

const reopenSchema = z.object({
  motivo: z.string().min(20, 'Descreva o motivo com pelo menos 20 caracteres'),
})

export async function reabrirFechamento(
  closingId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const result = reopenSchema.safeParse({ motivo: formData.get('motivo') })
  if (!result.success) return { error: result.error.errors[0].message }

  const { motivo } = result.data
  const supabase = await createSupabaseServerClient()

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id, periodo, status')
    .eq('id', closingId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!closing) return { error: 'Fechamento não encontrado.' }
  if (closing.status !== 'aprovado') return { error: 'Apenas fechamentos aprovados podem ser reabertos.' }

  const now = new Date().toISOString()

  await supabase
    .from('monthly_closings')
    .update({
      status: 'reaberto',
      reaberto_por: user.id,
      reaberto_em: now,
      reaberto_motivo: motivo,
    })
    .eq('id', closingId)

  await supabase
    .from('payouts')
    .update({ status: 'pending' })
    .eq('closing_id', closingId)
    .eq('status', 'approved')

  revalidatePath(`/fechamento/${closing.periodo}`)
  revalidatePath('/fechamento')
  return { error: null }
}
