import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateTechnicianPdf } from '@/lib/payouts'
import type { ClosingInfo, TechWithDetails, VisitDetail } from '@/lib/payouts/reports'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ periodo: string; tecnicoId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { periodo, tecnicoId } = await params
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

  const { data: tech } = await supabase
    .from('technicians')
    .select('id, nome_completo')
    .eq('id', tecnicoId)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!tech) return new Response('Not Found', { status: 404 })

  const { data: payoutsRaw } = await supabase
    .from('payouts')
    .select(
      `id, status, valor_calculado, valor_override,
       service_visits(os_num, data_execucao, finalidade, sucesso)`,
    )
    .eq('tenant_id', user.tenantId!)
    .eq('closing_id', closing.id)
    .eq('technician_id', tecnicoId)
    .not('status', 'in', '("no_rule_match","pending_classification","conflict")')

  type PayoutRow = {
    valor_calculado: string | null
    valor_override: string | null
    service_visits: unknown
  }

  const visitDetails: VisitDetail[] = (payoutsRaw ?? []).map((p) => {
    const row = p as PayoutRow
    const sv = row.service_visits as unknown as {
      os_num: number
      data_execucao: string
      finalidade: string | null
      sucesso: string | null
    } | null
    const valor = row.valor_override !== null ? Number(row.valor_override) : Number(row.valor_calculado)
    return {
      osNum: sv?.os_num ?? 0,
      data: sv?.data_execucao ?? '',
      finalidade: sv?.finalidade ?? null,
      sucesso: sv?.sucesso ?? '—',
      valor: isNaN(valor) ? 0 : valor,
    }
  })

  const totalAPagar = visitDetails.reduce((sum, v) => sum + v.valor, 0)

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

  const techWithDetails: TechWithDetails = {
    nome: tech.nome_completo,
    visitas: visitDetails.length,
    totalAPagar,
    visitDetails,
  }

  const buffer = await generateTechnicianPdf(techWithDetails, closingInfo, tenant?.nome ?? 'Tenant')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payout-${tech.nome_completo.replace(/\s+/g, '-')}-${periodo}.pdf"`,
    },
  })
}
