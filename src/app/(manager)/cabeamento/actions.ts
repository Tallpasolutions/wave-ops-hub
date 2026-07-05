'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayouts } from '@/lib/payouts'

const schema = z.object({
  explicacaoOriginal: z.string().min(1),
  explicacaoKey: z.string().min(1, 'Padrão inválido'),
  valor: z.coerce.number().nonnegative('Valor deve ser >= 0'),
})

// ADR-009: o gestor associa um padrão distinto de coluna Z (explicacao_key) a um valor da LPU.
// Salvo o mapeamento, recalcula os payouts (os Cabeamento com aquele padrão saem de no_rule_match).
export async function classifyCabeamento(
  _prev: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Tenant não encontrado.' }

  const parsed = schema.safeParse({
    explicacaoOriginal: formData.get('explicacaoOriginal'),
    explicacaoKey: formData.get('explicacaoKey'),
    valor: formData.get('valor'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('cabeamento_classifications').upsert(
    {
      tenant_id: user.tenantId,
      explicacao_original: parsed.data.explicacaoOriginal,
      explicacao_key: parsed.data.explicacaoKey,
      valor: parsed.data.valor,
    },
    { onConflict: 'tenant_id,explicacao_key' },
  )
  if (error) return { error: 'Erro ao salvar classificação. Tente novamente.' }

  // Recalcula os payouts afetados (mesmo padrão de updateReason)
  await recalculatePendingPayouts(user.tenantId, supabase)

  revalidatePath('/cabeamento')
  return { success: true, error: null }
}
