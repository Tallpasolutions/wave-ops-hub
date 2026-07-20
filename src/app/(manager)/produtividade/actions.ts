'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { runIqiCollection } from '@/lib/iqi'

// Sincronização manual do IQI (ADR-012). O agendamento 2x/dia é feito pelo Vercel Cron
// em /api/cron/iqi; este botão força uma coleta fora do horário. A coleta em si roda
// com service role dentro de runIqiCollection.
export async function sincronizarIqi(): Promise<{
  ok: boolean
  mensagem: string
}> {
  await requireRole(['tallpa_owner', 'tenant_owner', 'tenant_manager'])

  try {
    const r = await runIqiCollection()
    revalidatePath('/produtividade')
    const partes = [`${r.tecnicosProcessados} técnicos`, `${r.mesesGravados} meses`]
    if (r.semCodigoUnetvale.length > 0) {
      partes.push(`${r.semCodigoUnetvale.length} sem código Unetvale`)
    }
    if (r.erros.length > 0) partes.push(`${r.erros.length} com erro`)
    return { ok: r.erros.length === 0, mensagem: `Sincronizado: ${partes.join(' · ')}.` }
  } catch (e) {
    return {
      ok: false,
      mensagem: e instanceof Error ? e.message : 'Falha ao sincronizar o IQI.',
    }
  }
}
