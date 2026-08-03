'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const schema = z.object({ id: z.string().uuid() })

// ADR-021: "Ciente" é só reconhecimento — não muda payout nem status de fechamento. Serve para
// a alteração sair da fila do gestor depois de olhada. Quem decide mudar valor usa o ajuste
// manual em /pagamentos, e o técnico contesta pelo app.
export async function marcarCiente(
  _prev: { error: string | null; success?: boolean },
  formData: FormData,
): Promise<{ error: string | null; success?: boolean }> {
  const user = await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])
  if (!user.tenantId) return { error: 'Tenant não encontrado.' }

  const parsed = schema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: 'Registro inválido.' }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('unetvale_alteracoes')
    .update({ ciente_por: user.id, ciente_em: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', user.tenantId)

  if (error) {
    console.error('[marcarCiente]', error)
    return { error: 'Erro ao registrar ciência. Tente novamente.' }
  }

  revalidatePath('/alteracoes')
  revalidatePath('/pagamentos')
  return { success: true, error: null }
}
