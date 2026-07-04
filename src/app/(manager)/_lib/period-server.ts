import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateMonthRange, isValidMes, PERIODO_COOKIE } from './period'

// Intervalo de meses com dados operacionais (fora_escopo=false) do tenant.
// Duas queries indexadas (min/max) — leves. Cache por request dedup layout + page.
export const getDataRange = cache(
  async (
    supabase: SupabaseClient,
    tenantId: string,
  ): Promise<{ minMes: string; maxMes: string } | null> => {
    const [{ data: maxRow }, { data: minRow }] = await Promise.all([
      supabase
        .from('service_visits')
        .select('data_execucao')
        .eq('tenant_id', tenantId)
        .eq('fora_escopo', false)
        .order('data_execucao', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('service_visits')
        .select('data_execucao')
        .eq('tenant_id', tenantId)
        .eq('fora_escopo', false)
        .order('data_execucao', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    const max = (maxRow as { data_execucao: string } | null)?.data_execucao
    const min = (minRow as { data_execucao: string } | null)?.data_execucao
    if (!max || !min) return null
    return { minMes: min.slice(0, 7), maxMes: max.slice(0, 7) }
  },
)

// Períodos disponíveis (desc) para os chips do seletor. Vazio → o seletor cai no
// fallback dos últimos 6 meses.
export async function getAvailablePeriods(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const range = await getDataRange(supabase, tenantId)
  if (!range) return []
  return generateMonthRange(range.minMes, range.maxMes)
}

// Período efetivo de uma tela. Precedência: ?mes= explícito na URL > cookie da última
// escolha > último mês com dados > mês corrente (fallback quando não há dado nenhum).
export async function getEffectivePeriod(
  explicitMes: string | undefined,
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string> {
  if (isValidMes(explicitMes)) return explicitMes

  const cookieMes = (await cookies()).get(PERIODO_COOKIE)?.value
  if (isValidMes(cookieMes)) return cookieMes

  const range = await getDataRange(supabase, tenantId)
  if (range) return range.maxMes

  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
