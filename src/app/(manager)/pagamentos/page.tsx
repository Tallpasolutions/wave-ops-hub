import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Wallet } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'
import { recalculatePendingPayoutsAction } from './actions'

export const metadata: Metadata = { title: 'Pagamentos' }

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

  // Busca visitas do período com seus payouts — filtro de data direto em service_visits
  // para evitar instabilidade do filtro por join embutido no PostgREST
  const { data: visitsRaw } = await supabase
    .from('service_visits')
    .select(
      `id, os_num, data_execucao, finalidade, sucesso,
       payouts!inner(
         id, status, valor_calculado, valor_override,
         valor_deixado_na_mesa, visit_id, technician_id,
         technicians(nome_completo)
       )`,
    )
    .eq('tenant_id', user.tenantId!)
    .gte('data_execucao', inicio)
    .lt('data_execucao', fimExclusivo)
    .order('data_execucao', { ascending: false })
    .limit(2000)

  type RawPayout = {
    id: string
    status: string
    valor_calculado: number | null
    valor_override: number | null
    valor_deixado_na_mesa: number | null
    visit_id: string
    technician_id: string | null
    technicians: { nome_completo: string } | { nome_completo: string }[] | null
  }

  type PayoutRow = {
    id: string
    status: string
    valor_calculado: number | null
    valor_override: number | null
    technician_id: string | null
    tecnico: string | null
    os_num: number
    data_execucao: string
    finalidade: string | null
  }

  const allPayouts: PayoutRow[] = (visitsRaw ?? []).flatMap((v) => {
    const raw = v.payouts as unknown as RawPayout | RawPayout[]
    const p = Array.isArray(raw) ? raw[0] : raw
    if (!p) return []
    const tech = p.technicians
      ? Array.isArray(p.technicians)
        ? p.technicians[0]
        : p.technicians
      : null
    return [{
      id: p.id,
      status: p.status,
      valor_calculado: p.valor_calculado,
      valor_override: p.valor_override,
      technician_id: p.technician_id,
      tecnico: tech?.nome_completo ?? null,
      os_num: v.os_num as number,
      data_execucao: v.data_execucao as string,
      finalidade: v.finalidade as string | null,
    }]
  })

  const payouts = statusFilter
    ? allPayouts.filter((p) => p.status === statusFilter)
    : allPayouts

  // Contadores de pendências — sem filtro de período, mostra total do tenant
  const { data: pendRaw } = await supabase
    .from('payouts')
    .select('status')
    .eq('tenant_id', user.tenantId!)
    .in('status', ['no_rule_match', 'pending_classification', 'conflict'])

  const pendencias = (pendRaw ?? []).reduce(
    (acc, p) => {
      acc[p.status as keyof typeof acc] = (acc[p.status as keyof typeof acc] ?? 0) + 1
      return acc
    },
    { no_rule_match: 0, pending_classification: 0, conflict: 0 } as Record<string, number>,
  )

  const totalPendencias =
    pendencias.no_rule_match + pendencias.pending_classification + pendencias.conflict

  const mesParam = mes ? `&mes=${mes}` : ''

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Pagamentos</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {payouts.length} pagamento{payouts.length !== 1 ? 's' : ''} · {periodoLabel}
        </p>
      </div>

      {/* Pendências críticas com instruções acionáveis */}
      {totalPendencias > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.04)]">
          {/* Header do bloco */}
          <div className="flex items-center justify-between border-b border-[rgba(239,68,68,0.15)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0 text-[var(--red)]" />
              <p className="text-sm font-semibold text-[var(--red)]">
                {totalPendencias} pagamento{totalPendencias !== 1 ? 's' : ''} com pendência crítica
              </p>
            </div>
            <form action={recalculatePendingPayoutsAction}>
              <button
                type="submit"
                title="Recalcula todos os pagamentos pendentes com as regras LPU atuais"
                className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)]"
              >
                Recalcular pendentes
              </button>
            </form>
          </div>

          {/* Sem regra LPU */}
          {pendencias.no_rule_match > 0 && (
            <div className="border-b border-[rgba(239,68,68,0.1)] px-5 py-4">
              <div className="mb-1.5 flex items-start justify-between gap-4">
                <span className="text-sm font-semibold text-[var(--red)]">
                  {pendencias.no_rule_match} sem regra LPU
                </span>
                <Link
                  href={`/pagamentos?status=no_rule_match${mesParam}`}
                  className="shrink-0 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                >
                  Ver visitas ↓
                </Link>
              </div>
              <p className="mb-2 text-xs text-[var(--text-3)]">
                Nenhuma regra na LPU ativa cobre a combinação de finalidade, cidade ou tipo dessas visitas.
              </p>
              <p className="mb-2 text-xs text-[var(--text-2)]">
                <span className="font-semibold">Como corrigir:</span> acesse a LPU ativa, crie ou ajuste regras para cobrir as finalidades não mapeadas e clique em <span className="font-semibold">Recalcular pendentes</span> acima.
              </p>
              <Link
                href="/lpu"
                className="text-xs font-semibold text-[var(--blue)] transition-colors hover:underline"
              >
                Ir para LPU →
              </Link>
            </div>
          )}

          {/* Motivo pendente de classificação */}
          {pendencias.pending_classification > 0 && (
            <div className="border-b border-[rgba(239,68,68,0.1)] px-5 py-4">
              <div className="mb-1.5 flex items-start justify-between gap-4">
                <span className="text-sm font-semibold text-yellow-400">
                  {pendencias.pending_classification} com motivo pendente
                </span>
                <Link
                  href={`/pagamentos?status=pending_classification${mesParam}`}
                  className="shrink-0 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                >
                  Ver visitas ↓
                </Link>
              </div>
              <p className="mb-2 text-xs text-[var(--text-3)]">
                Visitas improdutivas cujo motivo ainda não foi classificado — sem categoria, não é possível saber se o técnico recebe pagamento.
              </p>
              <p className="mb-2 text-xs text-[var(--text-2)]">
                <span className="font-semibold">Como corrigir:</span> classifique cada motivo indicando se é falha do técnico, cliente ausente, reagendamento, etc. O sistema recalcula automaticamente após a classificação.
              </p>
              <Link
                href="/motivos?categoria=pendente_classificacao"
                className="text-xs font-semibold text-[var(--blue)] transition-colors hover:underline"
              >
                Classificar motivos →
              </Link>
            </div>
          )}

          {/* Conflito de prioridade */}
          {pendencias.conflict > 0 && (
            <div className="px-5 py-4">
              <div className="mb-1.5 flex items-start justify-between gap-4">
                <span className="text-sm font-semibold text-yellow-400">
                  {pendencias.conflict} com conflito de prioridade
                </span>
                <Link
                  href={`/pagamentos?status=conflict${mesParam}`}
                  className="shrink-0 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                >
                  Ver visitas ↓
                </Link>
              </div>
              <p className="mb-2 text-xs text-[var(--text-3)]">
                Mais de uma regra LPU ativa se aplica às mesmas visitas com a mesma prioridade — o sistema não consegue decidir qual usar.
              </p>
              <p className="mb-2 text-xs text-[var(--text-2)]">
                <span className="font-semibold">Como corrigir:</span> ajuste a prioridade das regras LPU para que apenas uma tenha maior prioridade para cada tipo de visita, depois clique em <span className="font-semibold">Recalcular pendentes</span> acima.
              </p>
              <Link
                href="/lpu"
                className="text-xs font-semibold text-[var(--blue)] transition-colors hover:underline"
              >
                Resolver na LPU →
              </Link>
            </div>
          )}
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
                  const valorEfetivo =
                    p.valor_override !== null ? Number(p.valor_override) : Number(p.valor_calculado)

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text)]">
                        {p.os_num}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                        {new Date(p.data_execucao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text)]">
                        {p.tecnico ?? 'Sem técnico'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                        {p.finalidade ?? '—'}
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
