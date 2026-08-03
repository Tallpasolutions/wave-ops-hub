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

  // ADR-019: a migration 0035 trocou o UNIQUE (tenant_id, explicacao_key) por índices únicos
  // PARCIAIS (um para lpu_id IS NULL, outro para lpu_id NOT NULL). O Postgres não infere índice
  // parcial sem o predicado, e o `on_conflict` do PostgREST não tem como passá-lo — o upsert
  // antigo voltava 42P10 e a tela ficava sem salvar. Update-or-insert explícito, escopado à
  // classificação do tenant (lpu_id IS NULL); as de LPU alternativa vêm por migration.
  const { data: existing, error: findError } = await supabase
    .from('cabeamento_classifications')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('explicacao_key', parsed.data.explicacaoKey)
    .is('lpu_id', null)
    .maybeSingle()

  if (findError) {
    console.error('[classifyCabeamento] busca falhou', findError)
    return { error: 'Erro ao salvar classificação. Tente novamente.' }
  }

  const { error } = existing
    ? await supabase
        .from('cabeamento_classifications')
        .update({
          explicacao_original: parsed.data.explicacaoOriginal,
          valor: parsed.data.valor,
        })
        .eq('id', existing.id)
    : await supabase.from('cabeamento_classifications').insert({
        tenant_id: user.tenantId,
        lpu_id: null,
        explicacao_original: parsed.data.explicacaoOriginal,
        explicacao_key: parsed.data.explicacaoKey,
        valor: parsed.data.valor,
      })

  if (error) {
    console.error('[classifyCabeamento] gravação falhou', error)
    return { error: 'Erro ao salvar classificação. Tente novamente.' }
  }

  // Recalcula os payouts afetados (mesmo padrão de updateReason)
  await recalculatePendingPayouts(user.tenantId, supabase)

  revalidatePath('/cabeamento')
  return { success: true, error: null }
}
