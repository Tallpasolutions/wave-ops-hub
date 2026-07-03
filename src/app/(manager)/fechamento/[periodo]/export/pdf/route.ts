import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { tecnicoDisplayName, tecnicoGroupKey } from '@/lib/format/tecnico'
import { generatePdfReport } from '@/lib/payouts'
import type { TechWithDetails, ClosingInfo } from '@/lib/payouts/reports'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ periodo: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { periodo } = await params
  const supabase = await createSupabaseServerClient()

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id, periodo, status, total_a_pagar, total_receita_unetvale, margem, total_visitas, aprovado_em')
    .eq('tenant_id', user.tenantId!)
    .eq('periodo', periodo)
    .single()

  if (!closing) return new Response('Not Found', { status: 404 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('nome')
    .eq('id', user.tenantId!)
    .single()

  const { data: payoutsRaw } = await supabase
    .from('payouts')
    .select(
      `id, status, valor_calculado, valor_override, technician_id,
       technicians(nome_completo),
       service_visits(tecnico_raw)`,
    )
    .eq('tenant_id', user.tenantId!)
    .eq('closing_id', closing.id)
    .not('status', 'in', '("no_rule_match","pending_classification","conflict")')

  type PayoutRow = {
    technician_id: string | null
    technicians: unknown
    service_visits: unknown
    valor_calculado: string | null
    valor_override: string | null
  }

  const techMap = new Map<string, TechWithDetails>()
  for (const p of (payoutsRaw ?? []) as PayoutRow[]) {
    const tech = p.technicians as unknown as { nome_completo: string } | null
    const sv = p.service_visits as unknown as { tecnico_raw: string | null } | null
    const techId = tecnicoGroupKey(p.technician_id, sv?.tecnico_raw)
    const nome = tecnicoDisplayName(tech?.nome_completo, sv?.tecnico_raw)
    const valor = p.valor_override !== null ? Number(p.valor_override) : Number(p.valor_calculado)
    const valorSafe = isNaN(valor) ? 0 : valor

    if (!techMap.has(techId)) techMap.set(techId, { nome, visitas: 0, totalAPagar: 0, visitDetails: [] })
    const g = techMap.get(techId)!
    g.visitas += 1
    g.totalAPagar += valorSafe
  }

  const periodoLabel = new Date(`${periodo}-01T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  const closingInfo: ClosingInfo = {
    periodo,
    periodoLabel,
    status: closing.status,
    aprovadoEm: closing.aprovado_em ?? null,
    aprovadoPorNome: null,
    totalAPagar: Number(closing.total_a_pagar ?? 0),
    totalReceitaUnetvale: Number(closing.total_receita_unetvale ?? 0),
    margem: Number(closing.margem ?? 0),
    totalVisitas: closing.total_visitas ?? 0,
  }

  const buffer = await generatePdfReport(closingInfo, [...techMap.values()], tenant?.nome ?? 'Tenant')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="fechamento-${periodo}.pdf"`,
    },
  })
}
