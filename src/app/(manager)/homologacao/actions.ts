'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { recalculatePendingPayouts } from '@/lib/payouts'

const schema = z.object({
  valorUnetvale: z.coerce.number().nonnegative('Valor da Unetvale deve ser >= 0'),
  valorRepasse: z.coerce.number().nonnegative('Repasse deve ser >= 0'),
})

// ADR-015: o gestor associa um valor da Unetvale a um repasse fixo de homologação.
// Salvo o mapeamento, recalcula os payouts (as homologações com aquele valor saem de
// no_rule_match e passam a repassar o valor correto).
export async function classifyHomologacao(
  _prev: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Tenant não encontrado.' }

  const parsed = schema.safeParse({
    valorUnetvale: formData.get('valorUnetvale'),
    valorRepasse: formData.get('valorRepasse'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('homologacao_classifications').upsert(
    {
      tenant_id: user.tenantId,
      valor_unetvale: parsed.data.valorUnetvale,
      valor_repasse: parsed.data.valorRepasse,
    },
    { onConflict: 'tenant_id,valor_unetvale' },
  )
  if (error) return { error: 'Erro ao salvar repasse. Tente novamente.' }

  await recalculatePendingPayouts(user.tenantId, supabase)

  revalidatePath('/homologacao')
  return { success: true, error: null }
}
