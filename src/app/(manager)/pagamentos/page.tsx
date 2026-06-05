import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Wallet } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Pagamentos' }
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ mes?: string; status?: string }>
}

function formatBRL(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_review: { label: 'Aguardando', cls: 'bg-white/5 text-[var(--text-3)]' },
    pending: { label: 'Pendente', cls: 'bg-white/5 text-[var(--text-2)]' },
    approved: { label: 'Aprovado', cls: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]' },
    paid: { label: 'Pago', cls: 'bg-[rgba(46,230,168,0.2)] text-[var(--green)]' },
    override: { label: 'Override', cls: 'bg-[rgba(250,204,21,0.12)] text-yellow-400' },
    no_rule_match: { label: 'Sem regra', cls: 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]' },
    pending_classification: { label: 'Motivo pendente', cls: 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]' },
    conflict: { label: 'Conflito', cls: 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]' },
    pending_calculation: { label: 'Calculando', cls: 'bg-white/5 text-[var(--text-3)]' },
    contestado: { label: 'Contestado', cls: 'bg-[rgba(250,204,21,0.12)] text-yellow-400' },
    pending_review_default: { label: status, cls: 'bg-white/5 text-[var(--text-3)]' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-white/5 text-[var(--text-3)]' }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

export default async function PayoutsPage({ searchParams }: Props) {
  const { mes, status: statusFilter } = await searchParams
  const { start: inicio, end: fimExclusivo, label: periodoLabel } = parsePeriod(mes)

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  // Payouts do período
  let payoutsQuery = supabase
    .from('payouts')
    .select(
      `id, status, valor_calculado, valor_override, valor_deixado_na_mesa,
       visit_id, technician_id,
       service_visits!inner(os_num, data_execucao, finalidade, sucesso),
       technicians(nome)`,
    )
    .eq('tenant_id', user.tenantId!)

  // Filtro por período via JOIN em service_visits
  payoutsQuery = payoutsQuery
    .gte('service_visits.data_execucao', inicio)
    .lt('service_visits.data_execucao', fimExclusivo)

  if (statusFilter) {
    payoutsQuery = payoutsQuery.eq('status', statusFilter)
  }

  const { data: payoutsRaw } = await payoutsQuery.order('service_visits(data_execucao)', {
    ascending: false,
  })

  const payouts = payoutsRaw ?? []

  // Contadores de pendências
  const allPayouts = await supabase
    .from('payouts')
    .select('status')
    .eq('tenant_id', user.tenantId!)
    .in('status', ['no_rule_match', 'pending_classification', 'conflict'])

  const pendencias = (allPayouts.data ?? []).reduce(
    (acc, p) => {
      acc[p.status as keyof typeof acc] = (acc[p.status as keyof typeof acc] ?? 0) + 1
      return acc
    },
    { no_rule_match: 0, pending_classification: 0, conflict: 0 } as Record<string, number>,
  )

  const totalPendencias =
    pendencias.no_rule_match + pendencias.pending_classification + pendencias.conflict

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Pagamentos</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Cálculos de pagamento por visita · {periodoLabel}
        </p>
      </div>

      {/* Pendências críticas */}
      {totalPendencias > 0 && (
        <div className="mb-6 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--red)]" />
            <p className="text-sm font-semibold text-[var(--red)]">
              {totalPendencias} pagamento{totalPendencias !== 1 ? 's' : ''} com pendência crítica
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-2)]">
            {pendencias.no_rule_match > 0 && (
              <Link
                href={`/pagamentos?status=no_rule_match`}
                className="hover:text-[var(--text)] underline"
              >
                {pendencias.no_rule_match} sem regra LPU
              </Link>
            )}
            {pendencias.pending_classification > 0 && (
              <Link
                href="/motivos?categoria=pendente_classificacao"
                className="hover:text-[var(--text)] underline"
              >
                {pendencias.pending_classification} com motivo pendente → classificar
              </Link>
            )}
            {pendencias.conflict > 0 && (
              <Link href="/lpu" className="hover:text-[var(--text)] underline">
                {pendencias.conflict} com conflito de prioridade → resolver na LPU
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      {payouts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum pagamento no período"
          description="Os pagamentos aparecerão aqui após o upload das visitas e o cálculo pela LPU ativa."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-1)]">
              <tr>
                {['OS', 'Data', 'Técnico', 'Finalidade', 'Status', 'Valor efetivo', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
              {payouts.map((p) => {
                const visit = p.service_visits as unknown as {
                  os_num: number
                  data_execucao: string
                  finalidade: string | null
                  sucesso: string | null
                } | null
                const tech = p.technicians as unknown as { nome: string } | null
                const valorEfetivo =
                  p.valor_override !== null ? Number(p.valor_override) : Number(p.valor_calculado)

                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-[var(--text)]">
                      {visit?.os_num ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                      {visit?.data_execucao
                        ? new Date(visit.data_execucao).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text)]">
                      {tech?.nome ?? 'Sem técnico'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                      {visit?.finalidade ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {formatBRL(isNaN(valorEfetivo) ? null : valorEfetivo)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/pagamentos/${p.id}`}
                        className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                      >
                        Detalhes →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
