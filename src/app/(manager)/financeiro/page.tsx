import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'

export const metadata: Metadata = { title: 'Financeiro' }
import {
  aggregateByFinalidade,
  aggregateByTecnico,
  aggregateTotals,
  buildRealtimeFinancialPoints,
} from './_lib/queries'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { FinanceiroChart } from './_components/FinanceiroChart'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ mes?: string }>
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function MargemBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 40
      ? 'text-[var(--green)]'
      : pct >= 20
        ? 'text-yellow-400'
        : 'text-[var(--red)]'
  return <span className={`font-medium ${cls}`}>{pct}%</span>
}

export default async function FinanceiroPage({ searchParams }: Props) {
  const { mes } = await searchParams
  const { start, end, label: periodoLabel } = parsePeriod(mes)
  const mesAtual = mes ?? start.slice(0, 7)

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  // Série histórica (últimos 6 meses de fechamentos)
  const now = new Date()
  const periodos: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periodos.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Range dos 6 meses do comparativo (do primeiro período até o fim do mês atual)
  const historicoStart = `${periodos[0]}-01`
  const [hy, hm] = periodos[periodos.length - 1].split('-').map(Number)
  const historicoEnd = new Date(hy, hm, 1).toISOString().slice(0, 10)

  // Toda leitura de visitas é paginada — .limit(5000) era cortado em 1000 pelo PostgREST
  const [{ data: closingAtual }, { rows: visitsRaw }, { rows: historicoRaw }] =
    await Promise.all([
      supabase
        .from('monthly_closings')
        .select('status')
        .eq('tenant_id', user.tenantId!)
        .eq('periodo', mesAtual)
        .maybeSingle(),
      fetchAllPages((from, to) =>
        supabase
          .from('service_visits')
          .select(
            `finalidade, valor_recebido_unetvale, tecnico_raw,
             technicians(id, nome_completo),
             payouts(status, valor_calculado, valor_override)`,
          )
          .eq('tenant_id', user.tenantId!)
          .gte('data_execucao', start)
          .lt('data_execucao', end)
          .order('id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabase
          .from('service_visits')
          .select(
            'data_execucao, valor_recebido_unetvale, payouts(status, valor_calculado, valor_override)',
          )
          .eq('tenant_id', user.tenantId!)
          .gte('data_execucao', historicoStart)
          .lt('data_execucao', historicoEnd)
          .order('id')
          .range(from, to),
      ),
    ])

  type VisitRow = {
    finalidade: string | null
    valor_recebido_unetvale: string | null
    tecnico_raw: string | null
    technicians: { id: string; nome_completo: string } | null
    payouts: { status: string; valor_calculado: string | null; valor_override: string | null } | null
  }
  type HistoricoRow = {
    data_execucao: string
    valor_recebido_unetvale: string | null
    payouts: { status: string; valor_calculado: string | null; valor_override: string | null } | null
  }

  const visits = (visitsRaw ?? []) as unknown as VisitRow[]

  const byFinalidade = aggregateByFinalidade(visits)
  const byTecnico = aggregateByTecnico(visits)
  const historico = buildRealtimeFinancialPoints(
    (historicoRaw ?? []) as unknown as HistoricoRow[],
    periodos,
  )

  // KPIs do período em tempo real (mesma fonte das tabelas abaixo)
  const { receita, pago, margem, margemPct } = aggregateTotals(visits)
  const fechamentoConsolidado =
    closingAtual?.status === 'aprovado' || closingAtual?.status === 'pago'


  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Financeiro</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Visão de margens e rentabilidade · {periodoLabel}
        </p>
      </div>

      {/* KPI cards — sempre em tempo real, mesma fonte das tabelas abaixo */}
      {visits.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          {fechamentoConsolidado ? (
            <span className="rounded-full bg-[rgba(46,230,168,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[var(--green)]">
              Fechamento {closingAtual?.status === 'pago' ? 'pago' : 'aprovado'}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-3)]">
              Valores em tempo real ·{' '}
              <Link href={`/fechamento/${mesAtual}`} className="text-[var(--cyan)] hover:underline">
                consolidar no fechamento →
              </Link>
            </span>
          )}
        </div>
      )}
      {visits.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Receita Unetvale
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--cyan)]">{formatBRL(receita)}</p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">
              {visits.length} visitas
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Pago técnicos
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{formatBRL(pago)}</p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">custo de mão de obra</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Margem
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                margem >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'
              }`}
            >
              {formatBRL(margem)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">receita − pago</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Margem %
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                margemPct >= 40
                  ? 'text-[var(--green)]'
                  : margemPct >= 20
                    ? 'text-yellow-400'
                    : 'text-[var(--red)]'
              }`}
            >
              {margemPct}%
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">do faturamento bruto</p>
          </div>
        </div>
      )}

      {/* Gráfico histórico 6 meses */}
      {historico.length > 0 && (
        <div className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Comparativo — últimos 6 meses
          </p>
          <FinanceiroChart data={historico} />
        </div>
      )}

      {/* Tabela por finalidade */}
      {byFinalidade.length > 0 && (
        <div className="mb-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Por finalidade · {periodoLabel}
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-1)]">
                <tr>
                  {['Finalidade', 'Visitas', 'Receita', 'Pago técnicos', 'Margem', 'Margem %'].map(
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
                {byFinalidade.map((row) => (
                  <tr key={row.finalidade} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {row.finalidade}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">{row.visitas}</td>
                    <td className="px-4 py-3 text-sm text-[var(--cyan)]">
                      {formatBRL(row.receita)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                      {formatBRL(row.pago)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {formatBRL(row.margem)}
                    </td>
                    <td className="px-4 py-3">
                      <MargemBadge pct={row.margemPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Tabela por técnico */}
      {byTecnico.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Por técnico (top 10 por receita) · {periodoLabel}
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-1)]">
                <tr>
                  {['Técnico', 'Visitas', 'Receita', 'Pago', 'Margem', 'Margem %'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                {byTecnico.map((row) => (
                  <tr key={row.tecnicoId} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {row.tecnicoId !== '__sem_tecnico__' && !row.tecnicoId.startsWith('raw:') ? (
                        <Link
                          href={`/equipe/tecnicos/${row.tecnicoId}?mes=${mesAtual}`}
                          className="hover:text-[var(--cyan)] transition-colors"
                        >
                          {row.tecnicoNome}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-3)]">{row.tecnicoNome}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">{row.visitas}</td>
                    <td className="px-4 py-3 text-sm text-[var(--cyan)]">
                      {formatBRL(row.receita)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                      {formatBRL(row.pago)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {formatBRL(row.margem)}
                    </td>
                    <td className="px-4 py-3">
                      <MargemBadge pct={row.margemPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — sem visitas no período */}
      {visits.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] py-16">
          <p className="text-sm text-[var(--text-3)]">
            Nenhuma visita registrada para {periodoLabel}.
          </p>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Faça um upload de planilha para ver dados financeiros.
          </p>
          <Link
            href="/uploads/new"
            className="mt-4 rounded-lg bg-[var(--cyan)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          >
            Fazer upload
          </Link>
        </div>
      )}
    </div>
  )
}
