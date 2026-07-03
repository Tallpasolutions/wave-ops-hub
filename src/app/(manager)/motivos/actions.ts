'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { tecnicoDisplayName } from '@/lib/format/tecnico'
import { recalculatePendingPayouts } from '@/lib/payouts'

export type VisitByReasonRow = {
  id: string
  osNum: number
  dataExecucao: string
  tecnicoNome: string | null
  payoutStatus: string | null
  valorCalculado: number | null
}

export async function getVisitsByReason(
  reasonId: string,
  period?: string,
): Promise<VisitByReasonRow[]> {
  const user = await getCurrentUser()
  if (!user?.tenantId) return []

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('service_visits')
    .select(
      `id, os_num, data_execucao, tecnico_raw,
       technicians(nome_completo),
       payouts(status, valor_calculado, valor_override)`,
    )
    .eq('tenant_id', user.tenantId)
    .eq('reason_id', reasonId)
    .order('data_execucao', { ascending: false })

  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    query = query.gte('data_execucao', start).lt('data_execucao', end)
  }

  const { data } = await query

  return (data ?? []).map((v) => {
    const tech = v.technicians as unknown as { nome_completo: string } | null
    const payout = v.payouts as unknown as {
      status: string | null
      valor_calculado: string | null
      valor_override: string | null
    } | null
    const valorEfetivo =
      payout?.valor_override !== null && payout?.valor_override !== undefined
        ? Number(payout.valor_override)
        : payout?.valor_calculado !== null && payout?.valor_calculado !== undefined
          ? Number(payout.valor_calculado)
          : null

    return {
      id: v.id,
      osNum: Number(v.os_num),
      dataExecucao: v.data_execucao,
      tecnicoNome: tecnicoDisplayName(tech?.nome_completo, v.tecnico_raw as string | null),
      payoutStatus: payout?.status ?? null,
      valorCalculado: valorEfetivo,
    }
  })
}

const updateReasonSchema = z.object({
  motivoNormalizado: z
    .string()
    .min(2, 'Nome normalizado deve ter pelo menos 2 caracteres')
    .max(200),
  categoria: z.enum(['falha_tecnico', 'falha_cliente', 'forca_maior', 'falha_sistema'], {
    errorMap: () => ({ message: 'Selecione uma categoria válida' }),
  }),
  observacao: z.string().max(500).optional().or(z.literal('')),
})

export async function updateReason(
  reasonId: string,
  _prevState: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const result = updateReasonSchema.safeParse({
    motivoNormalizado: formData.get('motivoNormalizado'),
    categoria: formData.get('categoria'),
    observacao: formData.get('observacao') ?? '',
  })

  if (!result.success) return { error: result.error.errors[0].message }

  const pagaImprodutiva = formData.get('pagaImprodutiva') === 'on'

  const valorRaw = (formData.get('valorImprodutiva') as string | null)?.trim()
  const valorImprodutiva = valorRaw ? parseFloat(valorRaw) : null

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase
    .from('reasons')
    .update({
      motivo_normalizado: result.data.motivoNormalizado,
      categoria: result.data.categoria,
      paga_improdutiva: pagaImprodutiva,
      valor_improdutiva: valorImprodutiva,
      observacao: result.data.observacao || null,
    })
    .eq('id', reasonId)

  if (dbError) return { error: 'Erro ao salvar motivo. Tente novamente.' }

  // Recalcula payouts que estavam pending_classification para este motivo
  if (user.tenantId) {
    const supabase = await createSupabaseServerClient()
    await recalculatePendingPayouts(user.tenantId, supabase)
  }

  revalidatePath('/motivos')
  revalidatePath(`/motivos/${reasonId}/edit`)
  return { success: true, error: null }
}
