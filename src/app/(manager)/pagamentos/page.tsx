import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, Wallet } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'
import { getEffectivePeriod } from '../_lib/period-server'
import { paginate } from '../_lib/pagination'
import { OsSearchInput } from '../_components/OsSearchInput'
import { Pagination } from '../_components/Pagination'
import { tecnicoDisplayName } from '@/lib/format/tecnico'
import { lpuFromEmbed, tabelaAlternativaLabel } from '@/lib/lpu/tabela-preco'
import { payoutStatusLabel } from '@/lib/labels/payout-status'
import { RecalcularButton } from './_components/RecalcularButton'

export const metadata: Metadata = { title: 'Pagamentos' }

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ mes?: string; status?: string; q?: string; page?: string; semTecnico?: string }>
}

function formatBRL(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusBadge({ status }: { status: string }) {
  const { curto: label, cls } = payoutStatusLabel(status)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

export default async function PayoutsPage({ searchParams }: Props) {
  const { mes, status: statusFilter, q, page, semTecnico } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const mesEfetivo = await getEffectivePeriod(mes, supabase, user.tenantId!)
  const { start: inicio, end: fimExclusivo, label: periodoLabel } = parsePeriod(mesEfetivo)

  // Busca visitas do período com seus payouts — filtro de data direto em service_visits
  // para evitar instabilidade do filtro por join embutido no PostgREST
  const { data: visitsRaw } = await supabase
    .from('service_visits')
    .select(
      `id, os_num, data_execucao, finalidade, sucesso, tecnico_raw,
       payouts!inner(
         id, status, valor_calculado, valor_override,
         valor_deixado_na_mesa, visit_id, technician_id,
         technicians(nome_completo),
         lpus(nome, ativa)
       )`,
    )
    .eq('tenant_id', user.tenantId!)
    .eq('fora_escopo', false)
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
    lpus: unknown
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
    // ADR-014: nome da tabela alternativa que pagou; null quando veio da padrão
    tabelaAlternativa: string | null
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
      tecnico: tecnicoDisplayName(tech?.nome_completo, v.tecnico_raw as string | null),
      os_num: v.os_num as number,
      data_execucao: v.data_execucao as string,
      finalidade: v.finalidade as string | null,
      tabelaAlternativa: tabelaAlternativaLabel(lpuFromEmbed(p.lpus)),
    }]
  })

  const query = q?.trim()
  const payoutsFiltrados = allPayouts.filter(
    (p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!semTecnico || !p.technician_id) &&
      (!query || String(p.os_num).includes(query)),
  )
  const { pageItems: payouts, info: pageInfo } = paginate(payoutsFiltrados, page)

  // Contadores de pendências — GLOBAIS (todas as competências), não do período.
  // Queries count (head) dão o total exato, sem o corte de 1000 linhas do PostgREST.
  const countPendencia = (status: string) =>
    supabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId!)
      .eq('status', status)

  const [nrmRes, pcRes, cfRes, altRes] = await Promise.all([
    countPendencia('no_rule_match'),
    countPendencia('pending_classification'),
    countPendencia('conflict'),
    // ADR-021: alterações de valor da Unetvale ainda não olhadas pelo gestor. É informativo —
    // não entra em `totalPendencias` e não bloqueia o fechamento (decisão da Wave, 03/08).
    supabase
      .from('unetvale_alteracoes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId!)
      .is('ciente_em', null),
  ])

  const alteracoesSemCiencia = altRes.count ?? 0

  const pendencias = {
    no_rule_match: nrmRes.count ?? 0,
    pending_classification: pcRes.count ?? 0,
    conflict: cfRes.count ?? 0,
  }

  const totalPendencias =
    pendencias.no_rule_match + pendencias.pending_classification + pendencias.conflict

  const mesParam = `&mes=${mesEfetivo}`

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Pagamentos</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {payoutsFiltrados.length} pagamento{payoutsFiltrados.length !== 1 ? 's' : ''} · {periodoLabel}
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
                <span className="ml-1.5 font-normal text-[var(--text-3)]">· todas as competências</span>
              </p>
            </div>
            <RecalcularButton />
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

      {/* ADR-021: alterações de valor da Unetvale. Aviso, não bloqueio — o fechamento segue
          normalmente; isto só garante que a redução de receita não passe despercebida. */}
      {alteracoesSemCiencia > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(255,181,71,0.25)] bg-[rgba(255,181,71,0.05)] px-5 py-3.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--amber)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--amber)]">
                {alteracoesSemCiencia}{' '}
                {alteracoesSemCiencia === 1
                  ? 'OS teve o valor alterado pela Unetvale'
                  : 'OSs tiveram o valor alterado pela Unetvale'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-3)]">
                Alteração por abertura de OS de garantia, ainda sem ciência. Não bloqueia o
                fechamento.
              </p>
            </div>
          </div>
          <Link
            href="/alteracoes"
            className="shrink-0 text-xs font-semibold text-[var(--amber)] transition-opacity hover:opacity-80"
          >
            Revisar →
          </Link>
        </div>
      )}

      {/* Busca por nº de OS */}
      <div className="mb-4">
        <OsSearchInput />
      </div>

      {/* Tabela */}
      {payoutsFiltrados.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={query ? `Nenhum pagamento para "${query}"` : 'Nenhum pagamento no período'}
          description={
            query
              ? 'Verifique o número da OS ou limpe a busca.'
              : 'Os pagamentos aparecerão aqui após o upload das visitas e o cálculo pela LPU ativa.'
          }
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
                        {p.tecnico}
                        {/* ADR-014: só a tabela alternativa é sinalizada — marcar a padrão em
                            toda linha viraria ruído e esconderia a exceção. Fica junto do
                            técnico (a tabela é dele) para não abrir coluna nova. */}
                        {p.tabelaAlternativa && (
                          <span className="ml-2 whitespace-nowrap rounded bg-[rgba(56,189,248,0.12)] px-1.5 py-0.5 text-[10px] text-[var(--cyan)]">
                            {p.tabelaAlternativa}
                          </span>
                        )}
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
          <div className="border-t border-[var(--line)] px-3">
            <Pagination info={pageInfo} />
          </div>
        </div>
      )}
    </div>
  )
}
