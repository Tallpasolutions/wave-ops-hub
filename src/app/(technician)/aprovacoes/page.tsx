import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AprovacaoPeriodo } from './_components/AprovacaoPeriodo'
import type { PayoutItem } from './_components/AprovacaoPeriodo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Aprovações' }

function monthBounds(periodo: string) {
  const [y, m] = periodo.split('-').map(Number)
  const start = `${periodo}-01`
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { start, end, label }
}

const num = (v: string | number | null) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

export default async function AprovacoesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.technicianId || !user.tenantId) redirect('/profile')

  const supabase = await createSupabaseServerClient()

  // Período ativo = revisão mais recente ainda pendente ou contestada.
  const { data: reviews } = await supabase
    .from('closing_technician_reviews')
    .select('periodo, status')
    .eq('tenant_id', user.tenantId)
    .eq('technician_id', user.technicianId)
    .in('status', ['pendente', 'contestado'])
    .order('periodo', { ascending: false })
    .limit(1)

  const review = reviews?.[0] as { periodo: string; status: string } | undefined

  if (!review) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Aprovações</h1>
          <p className="mt-0.5 text-[12px] text-[var(--text-2)]">Conferência das suas OSs</p>
        </div>
        <EmptyState
          variant="card"
          icon={CheckCircle2}
          title="Nada para conferir"
          description="Quando a Wave solicitar aprovação de um fechamento, suas OSs aparecerão aqui para você validar ou contestar."
        />
      </div>
    )
  }

  const { start, end, label } = monthBounds(review.periodo)

  const [{ data: payoutsRaw }, { data: contestacoesRaw }] = await Promise.all([
    supabase
      .from('payouts')
      .select(
        'id, status, valor_calculado, valor_override, acrescimo_dom_feriado, service_visits!inner(os_num, data_execucao, finalidade)',
      )
      .eq('tenant_id', user.tenantId)
      .eq('technician_id', user.technicianId)
      .gte('service_visits.data_execucao', start)
      .lt('service_visits.data_execucao', end),

    supabase
      .from('payout_contestacoes')
      .select('payout_id, status, motivo, resposta_gestor, valor_anterior, valor_novo')
      .eq('tenant_id', user.tenantId)
      .eq('technician_id', user.technicianId)
      .eq('periodo', review.periodo),
  ])

  const toNum = (v: unknown) => (v == null ? null : Number(v))
  const contestacaoByPayout = new Map(
    (contestacoesRaw ?? []).map((c) => [
      c.payout_id as string,
      {
        status: c.status as 'aberta' | 'resolvida',
        motivo: c.motivo as string,
        resposta: (c.resposta_gestor as string | null) ?? null,
        valorAnterior: toNum(c.valor_anterior),
        valorNovo: toNum(c.valor_novo),
      },
    ]),
  )

  const items: PayoutItem[] = (payoutsRaw ?? []).map((p) => {
    const sv = p.service_visits as unknown as {
      os_num: number
      data_execucao: string
      finalidade: string | null
    }
    return {
      id: p.id as string,
      osNum: sv.os_num,
      data: sv.data_execucao,
      finalidade: sv.finalidade,
      valor: p.valor_override !== null ? num(p.valor_override) : num(p.valor_calculado),
      // ADR-011: acréscimo de domingo/feriado embutido no valor calculado. Só sinaliza quando
      // não há override (o override substitui o valor calculado).
      acrescimoDomFeriado:
        p.valor_override !== null || p.acrescimo_dom_feriado == null
          ? null
          : num(p.acrescimo_dom_feriado),
      contestacao: contestacaoByPayout.get(p.id as string) ?? null,
    }
  })
  items.sort((a, b) => b.data.localeCompare(a.data))

  return (
    <AprovacaoPeriodo
      periodo={review.periodo}
      periodoLabel={label}
      items={items}
    />
  )
}
