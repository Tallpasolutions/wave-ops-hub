'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayouts } from '@/lib/payouts'

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

export async function recalculatePendingPayoutsAction(): Promise<void> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) throw new Error('Usuário sem tenant')
  const supabase = await createSupabaseServerClient()
  await recalculatePendingPayouts(user.tenantId, supabase)
  revalidatePath('/pagamentos')
}
