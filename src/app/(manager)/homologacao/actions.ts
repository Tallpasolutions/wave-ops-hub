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

  // Mesmo motivo do cabeamento (ADR-019 / migration 0035): o UNIQUE virou índice único parcial
  // e o `on_conflict` do PostgREST não consegue inferi-lo (42P10). Update-or-insert explícito,
  // escopado ao repasse do tenant (lpu_id IS NULL).
  const { data: existing, error: findError } = await supabase
    .from('homologacao_classifications')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('valor_unetvale', parsed.data.valorUnetvale)
    .is('lpu_id', null)
    .maybeSingle()

  if (findError) {
    console.error('[classifyHomologacao] busca falhou', findError)
    return { error: 'Erro ao salvar repasse. Tente novamente.' }
  }

  const { error } = existing
    ? await supabase
        .from('homologacao_classifications')
        .update({ valor_repasse: parsed.data.valorRepasse })
        .eq('id', existing.id)
    : await supabase.from('homologacao_classifications').insert({
        tenant_id: user.tenantId,
        lpu_id: null,
        valor_unetvale: parsed.data.valorUnetvale,
        valor_repasse: parsed.data.valorRepasse,
      })

  if (error) {
    console.error('[classifyHomologacao] gravação falhou', error)
    return { error: 'Erro ao salvar repasse. Tente novamente.' }
  }

  await recalculatePendingPayouts(user.tenantId, supabase)

  revalidatePath('/homologacao')
  return { success: true, error: null }
}
