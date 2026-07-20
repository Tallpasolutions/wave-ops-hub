'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { validateClosingReadiness, buildClosingTotals } from '@/lib/payouts'
import { notifyTechnician } from '@/lib/notifications/notify'

export async function solicitarAprovacao(periodo: string, _formData: FormData) {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  const supabase = await createSupabaseServerClient()

  const [y, m] = periodo.split('-').map(Number)
  const periodoFim = new Date(y, m, 1).toISOString().slice(0, 10)

  // service_visits!inner: sem o !inner o gte/lt não filtra os payouts — a validação
  // rodava sobre payouts de todos os períodos (cortados em 1000 pelo PostgREST).
  const { data: payouts } = await fetchAllPages((from, to) =>
    supabase
      .from('payouts')
      .select(
        `id, status, valor_calculado, valor_override, technician_id,
         service_visits!inner(tecnico_id, data_execucao)`,
      )
      .eq('tenant_id', user.tenantId!)
      .gte('service_visits.data_execucao' as never, `${periodo}-01`)
      .lt('service_visits.data_execucao' as never, periodoFim)
      .order('id')
      .range(from, to),
  ).then(({ rows, error }) => ({ data: error ? null : rows }))

  const payoutsForPeriod = (payouts ?? []).map((p) => ({
    id: p.id,
    status: p.status as import('@/lib/payouts').DbPayoutStatus,
    valorCalculado: p.valor_calculado,
    valorOverride: p.valor_override,
  }))

  const visitsWithoutTech = (payouts ?? []).filter((p) => {
    const sv = p.service_visits as unknown as { tecnico_id: string | null } | null
    return !sv?.tecnico_id
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

  // Abre a revisão de cada técnico do período (reseta se já solicitado antes) e o notifica
  // para conferir suas OSs no app (fluxo de contestação — Sprint 18).
  const techIds = [
    ...new Set(
      (payouts ?? [])
        .map((p) => (p as { technician_id: string | null }).technician_id)
        .filter((id): id is string => !!id),
    ),
  ]
  if (techIds.length > 0) {
    await supabase.from('closing_technician_reviews').upsert(
      techIds.map((technician_id) => ({
        tenant_id: user.tenantId!,
        periodo,
        technician_id,
        status: 'pendente',
        reviewed_at: null,
      })),
      { onConflict: 'tenant_id,periodo,technician_id' },
    )
    await Promise.all(
      techIds.map((technician_id) =>
        notifyTechnician(user.tenantId!, technician_id, {
          type: 'payout_review_requested',
          title: 'OSs para conferir',
          body: `A Wave solicitou sua conferência das OSs de ${periodo}. Revise para aprovar ou contestar.`,
          link: '/aprovacoes',
        }),
      ),
    )
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

  // Guarda: não aprovar com contestações abertas do período (resolver antes).
  const { count: contestacoesAbertas } = await supabase
    .from('payout_contestacoes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId!)
    .eq('periodo', closing.periodo)
    .eq('status', 'aberta')
  if ((contestacoesAbertas ?? 0) > 0) {
    redirect(
      `/fechamento/${closing.periodo}?error=${encodeURIComponent(
        'Existem contestações abertas — resolva antes de aprovar o pagamento.',
      )}`,
    )
  }

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

  const techIds = [
    ...new Set((payouts ?? []).map((p) => p.technician_id).filter((id): id is string => !!id)),
  ]
  await Promise.all(
    techIds.map((technician_id) =>
      notifyTechnician(user.tenantId!, technician_id, {
        type: 'payout_approved',
        title: 'Pagamento aprovado',
        body: `Seu pagamento do período ${closing.periodo} foi aprovado.`,
        link: '/aprovacoes',
      }),
    ),
  )

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

  const techIds = [
    ...new Set((payouts ?? []).map((p) => p.technician_id).filter((id): id is string => !!id)),
  ]
  await Promise.all(
    techIds.map((technician_id) =>
      notifyTechnician(user.tenantId!, technician_id, {
        type: 'payout_paid',
        title: 'Pagamento realizado',
        body: `Seu pagamento do período ${closing.periodo} foi marcado como pago.`,
        link: '/aprovacoes',
      }),
    ),
  )

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

const resolverSchema = z.object({
  resposta: z.string().min(5, 'Descreva a resposta com pelo menos 5 caracteres'),
})

// Resolve uma contestação: registra a resposta, devolve o payout para 'pending' e
// reabre a revisão do técnico (para ele conferir de novo). Notifica o técnico.
export async function resolverContestacao(
  contestacaoId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const parsed = resolverSchema.safeParse({ resposta: formData.get('resposta') })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const supabase = await createSupabaseServerClient()

  const { data: c } = await supabase
    .from('payout_contestacoes')
    .select('id, periodo, payout_id, technician_id, status')
    .eq('id', contestacaoId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!c) return { error: 'Contestação não encontrada.' }
  if (c.status !== 'aberta') return { error: 'Contestação já resolvida.' }

  const now = new Date().toISOString()

  await supabase
    .from('payout_contestacoes')
    .update({
      status: 'resolvida',
      resposta_gestor: parsed.data.resposta,
      resolved_by: user.id,
      resolved_at: now,
    })
    .eq('id', contestacaoId)

  // Payout volta para 'pending' (o gestor pode ter ajustado o valor via override antes).
  await supabase
    .from('payouts')
    .update({ status: 'pending' })
    .eq('id', c.payout_id)
    .eq('status', 'contestado')

  // Técnico revê de novo.
  await supabase
    .from('closing_technician_reviews')
    .update({ status: 'pendente', reviewed_at: null })
    .eq('tenant_id', user.tenantId!)
    .eq('periodo', c.periodo)
    .eq('technician_id', c.technician_id)

  await notifyTechnician(user.tenantId!, c.technician_id, {
    type: 'contestacao_resolvida',
    title: 'Contestação respondida',
    body: `Sua contestação de ${c.periodo} foi respondida. Confira novamente para aprovar.`,
    link: '/aprovacoes',
  })

  revalidatePath(`/fechamento/${c.periodo}`)
  return { error: null }
}
