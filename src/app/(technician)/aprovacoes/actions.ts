'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notifyManagers } from '@/lib/notifications/notify'

const TECH_ROLES = ['tenant_technician', 'tenant_supervisor'] as const

const contestarSchema = z.object({
  payoutId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  motivo: z.string().min(5, 'Descreva o motivo com pelo menos 5 caracteres').max(1000),
})

// Técnico contesta um payout: registra a contestação, marca o payout como
// 'contestado', põe a revisão do período em 'contestado' e notifica a Wave.
export async function contestarPayout(
  _prevState: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole([...TECH_ROLES])
  if (!user.technicianId || !user.tenantId) return { error: 'Técnico não identificado.' }

  const parsed = contestarSchema.safeParse({
    payoutId: formData.get('payoutId'),
    periodo: formData.get('periodo'),
    motivo: formData.get('motivo'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const { payoutId, periodo, motivo } = parsed.data

  const supabase = await createSupabaseServerClient()

  // RLS garante que o técnico só enxerga/mexe no próprio payout.
  const { data: payout } = await supabase
    .from('payouts')
    .select('id, technician_id')
    .eq('id', payoutId)
    .eq('technician_id', user.technicianId)
    .single()
  if (!payout) return { error: 'Pagamento não encontrado.' }

  const { error: insErr } = await supabase.from('payout_contestacoes').insert({
    tenant_id: user.tenantId,
    payout_id: payoutId,
    technician_id: user.technicianId,
    periodo,
    motivo,
  })
  if (insErr) return { error: 'Já existe uma contestação aberta para esta OS.' }

  await supabase.from('payouts').update({ status: 'contestado' }).eq('id', payoutId)

  await supabase
    .from('closing_technician_reviews')
    .update({ status: 'contestado', reviewed_at: null })
    .eq('tenant_id', user.tenantId)
    .eq('periodo', periodo)
    .eq('technician_id', user.technicianId)

  await notifyManagers(user.tenantId, {
    type: 'payout_contested',
    title: 'OS contestada por técnico',
    body: `${user.nomeCompleto} contestou uma OS do período ${periodo}.`,
    link: `/fechamento/${periodo}`,
  })

  revalidatePath('/aprovacoes')
  return { error: null, success: true }
}

const aprovarSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
})

// Técnico aprova a revisão do período (sem contestações pendentes). Notifica a Wave.
export async function aprovarRevisao(
  _prevState: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole([...TECH_ROLES])
  if (!user.technicianId || !user.tenantId) return { error: 'Técnico não identificado.' }

  const parsed = aprovarSchema.safeParse({ periodo: formData.get('periodo') })
  if (!parsed.success) return { error: parsed.error.errors[0].message }
  const { periodo } = parsed.data

  const supabase = await createSupabaseServerClient()

  // Não aprovar com contestação aberta no período.
  const { count: abertas } = await supabase
    .from('payout_contestacoes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .eq('periodo', periodo)
    .eq('technician_id', user.technicianId)
    .eq('status', 'aberta')
  if ((abertas ?? 0) > 0) {
    return { error: 'Você tem contestações abertas neste período. Aguarde a resposta da Wave.' }
  }

  await supabase
    .from('closing_technician_reviews')
    .update({ status: 'aprovado', reviewed_at: new Date().toISOString() })
    .eq('tenant_id', user.tenantId)
    .eq('periodo', periodo)
    .eq('technician_id', user.technicianId)

  await notifyManagers(user.tenantId, {
    type: 'payout_review_approved',
    title: 'Técnico aprovou o período',
    body: `${user.nomeCompleto} conferiu e aprovou as OSs de ${periodo}.`,
    link: `/fechamento/${periodo}`,
  })

  revalidatePath('/aprovacoes')
  return { error: null, success: true }
}
