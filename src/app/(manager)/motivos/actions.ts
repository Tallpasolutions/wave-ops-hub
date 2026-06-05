'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayouts } from '@/lib/payouts'

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
