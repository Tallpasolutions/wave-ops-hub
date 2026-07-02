import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'
import { ImprodutivasTable } from './_components/ImprodutivasTable'
import type { ImprodutivaRow } from './_components/ImprodutivasTable'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Aprovação de Improdutivas' }

type Props = {
  searchParams: Promise<{ tecnico?: string; mes?: string }>
}

export default async function ImprodutivasPage({ searchParams }: Props) {
  const { tecnico, mes } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  // Constrói a query base — payouts improdutivos pendentes de aprovação
  let payoutsQuery = supabase
    .from('payouts')
    .select(
      `id, valor_calculado, technician_id,
       service_visits!inner(os_num, data_execucao),
       technicians(id, nome),
       reasons!inner(motivo_normalizado, motivo_original, categoria)`,
    )
    .eq('tenant_id', user.tenantId!)
    .is('improdutiva_aprovada', null)
    .not('reason_id', 'is', null)
    .order('service_visits(data_execucao)', { ascending: false })

  // Filtro de período: só aplica quando o usuário seleciona um mês no topbar.
  // Por padrão mostra TODA a fila pendente, independente do período — comportamento
  // correto para uma fila de aprovação.
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const { start, end } = parsePeriod(mes)

    // Two-step: busca IDs das visitas do período (filtro direto na tabela com a coluna de data)
    // para evitar instabilidade do filtro por join embutido no PostgREST
    const { data: visitData } = await supabase
      .from('service_visits')
      .select('id')
      .eq('tenant_id', user.tenantId!)
      .gte('data_execucao', start)
      .lt('data_execucao', end)

    const visitIds = (visitData ?? []).map((v) => v.id)

    if (visitIds.length === 0) {
      // Nenhuma visita no período — força retorno vazio sem usar UUID falso
      payoutsQuery = payoutsQuery.is('visit_id', null)
    } else {
      payoutsQuery = payoutsQuery.in('visit_id', visitIds)
    }
  }

  if (tecnico) {
    payoutsQuery = payoutsQuery.eq('technician_id', tecnico)
  }

  const { data: raw } = await payoutsQuery

  const rows: ImprodutivaRow[] = (raw ?? []).map((p) => {
    const visit = p.service_visits as unknown as { os_num: number; data_execucao: string }
    const tech = p.technicians as unknown as { id: string; nome: string } | null
    const reason = p.reasons as unknown as {
      motivo_normalizado: string | null
      motivo_original: string
      categoria: string
    }
    return {
      id: p.id,
      osNum: Number(visit.os_num),
      dataExecucao: visit.data_execucao,
      tecnicoId: tech?.id ?? null,
      tecnicoNome: tech?.nome ?? null,
      motivo: reason.motivo_normalizado ?? reason.motivo_original,
      categoria: reason.categoria,
      valorCalculado: p.valor_calculado !== null ? Number(p.valor_calculado) : null,
    }
  })

  const technicianOptions = Array.from(
    new Map(rows.filter((r) => r.tecnicoId).map((r) => [r.tecnicoId!, r.tecnicoNome!])).entries(),
  ).map(([id, nome]) => ({ id, nome }))

  const { label: periodoLabel } = mes ? parsePeriod(mes) : { label: 'todos os períodos' }

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Aprovação de Improdutivas
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {rows.length} {rows.length === 1 ? 'visita pendente' : 'visitas pendentes'} de decisão
          {' · '}
          {periodoLabel}
        </p>
      </div>

      {technicianOptions.length > 0 && (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Técnico
            </label>
            <select
              name="tecnico"
              defaultValue={tecnico ?? ''}
              className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)]"
            >
              <option value="">Todos</option>
              {technicianOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          {mes && <input type="hidden" name="mes" value={mes} />}
          <button
            type="submit"
            className="rounded-lg bg-[var(--cyan)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          >
            Filtrar
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma improdutiva pendente de aprovação"
          description={
            mes
              ? `Sem improdutivas pendentes em ${periodoLabel}. Selecione outro período ou remova o filtro.`
              : 'Quando houver visitas improdutivas aguardando decisão, elas aparecerão aqui.'
          }
        />
      ) : (
        <ImprodutivasTable rows={rows} />
      )}
    </div>
  )
}
