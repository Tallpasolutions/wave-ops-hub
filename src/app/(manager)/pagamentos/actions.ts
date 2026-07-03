'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayoutsChunk, type ChunkRecalcResult } from '@/lib/payouts'

const overridePayoutSchema = z.object({
  valorOverride: z.coerce.number().positive('O valor deve ser positivo'),
  overrideMotivo: z
    .string()
    .min(10, 'Descreva o motivo do override (mínimo 10 caracteres)'),
})

export async function overridePayout(
  payoutId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  const result = overridePayoutSchema.safeParse({
    valorOverride: formData.get('valorOverride'),
    overrideMotivo: formData.get('overrideMotivo'),
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { valorOverride, overrideMotivo } = result.data

  const supabase = await createSupabaseServerClient()
  const { error: dbError } = await supabase
    .from('payouts')
    .update({
      valor_override: valorOverride,
      override_motivo: overrideMotivo,
      override_by: user.id,
      override_at: new Date().toISOString(),
      status: 'override',
    })
    .eq('id', payoutId)
    .eq('tenant_id', user.tenantId!)

  if (dbError) return { error: 'Erro ao salvar override. Tente novamente.' }

  revalidatePath('/pagamentos')
  revalidatePath(`/pagamentos/${payoutId}`)
  return { error: null }
}

type RecalcChunkResponse =
  | ({ ok: true } & ChunkRecalcResult)
  | { ok: false; error: string }

// Uma página por invocação: o cliente itera até hasMore=false exibindo progresso.
// A versão anterior (tenant inteiro numa invocação) estourava o tempo da função → 503
// sem nenhum feedback (C3 do QA de 02/07/2026).
export async function recalcularPendentesChunk(
  offsetRaw: number,
): Promise<RecalcChunkResponse> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { ok: false, error: 'Usuário sem tenant.' }

  const parsed = z.number().int().min(0).safeParse(offsetRaw)
  if (!parsed.success) return { ok: false, error: 'Offset inválido.' }

  try {
    const supabase = await createSupabaseServerClient()
    const result = await recalculatePendingPayoutsChunk(user.tenantId, supabase, parsed.data)
    if (result.errors > 0) {
      return { ok: false, error: 'Erro ao recalcular um dos lotes. Tente novamente.' }
    }
    if (!result.hasMore) revalidatePath('/pagamentos')
    return { ok: true, ...result }
  } catch {
    return { ok: false, error: 'Erro inesperado ao recalcular. Tente novamente.' }
  }
}
