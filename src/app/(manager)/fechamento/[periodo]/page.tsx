import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, MessageSquareWarning, Users } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { tecnicoDisplayName, tecnicoGroupKey } from '@/lib/format/tecnico'
import { Button } from '@/components/ui/button'

export async function generateMetadata({ params }: { params: Promise<{ periodo: string }> }): Promise<Metadata> {
  const { periodo } = await params
  return { title: `Fechamento ${periodo}` }
}
import {
  solicitarAprovacao,
  aprovarFechamento,
  marcarComoPago,
} from '../actions'
import { ReopenForm } from './_components/ReopenForm'
import { ResolverContestacaoForm } from './_components/ResolverContestacaoForm'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ periodo: string }>
  searchParams: Promise<{ error?: string }>
}

type ClosingStatus = 'aberto' | 'aguardando_aprovacao' | 'aprovado' | 'pago' | 'reaberto'

function formatBRL(value: number | string | null): string {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusBadge({ status }: { status: ClosingStatus }) {
  const map: Record<ClosingStatus, { label: string; cls: string }> = {
    aberto: { label: 'Aberto', cls: 'bg-white/5 text-[var(--text-2)]' },
    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-[rgba(250,204,21,0.12)] text-yellow-400' },
    aprovado: { label: 'Aprovado', cls: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]' },
    pago: { label: 'Pago', cls: 'bg-[rgba(46,230,168,0.2)] text-[var(--green)]' },
    reaberto: { label: 'Reaberto', cls: 'bg-[rgba(250,204,21,0.12)] text-yellow-400' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

type PayoutRow = {
  id: string
  status: string
  valor_calculado: string | null
  valor_override: string | null
  technician_id: string | null
  technicians: unknown
  service_visits: unknown
}

function getValorEfetivo(p: PayoutRow): number {
  const v = p.valor_override !== null ? Number(p.valor_override) : Number(p.valor_calculado)
  return isNaN(v) ? 0 : v
}

export default async function FechamentoPeriodoPage({ params, searchParams }: Props) {
  const { periodo } = await params
  const { error: errorParam } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: closing } = await supabase
    .from('monthly_closings')
    .select('id, periodo, status, total_a_pagar, total_visitas, total_receita_unetvale, margem, aprovado_em, pago_em')
    .eq('tenant_id', user.tenantId!)
    .eq('periodo', periodo)
    .single()

  if (!closing) notFound()

  const [y, m] = periodo.split('-').map(Number)
  const periodoFim = new Date(y, m, 1).toISOString().slice(0, 10)

  // service_visits!inner: sem o !inner, o gte/lt filtra apenas o embed e a query
  // retorna payouts de TODOS os períodos (cortados em 1000 pelo PostgREST).
  const { rows: payoutsRaw } = await fetchAllPages((from, to) =>
    supabase
      .from('payouts')
      .select(
        `id, status, valor_calculado, valor_override, technician_id,
         technicians(nome_completo),
         service_visits!inner(os_num, data_execucao, finalidade, tecnico_raw)`,
      )
      .eq('tenant_id', user.tenantId!)
      .gte('service_visits.data_execucao' as never, `${periodo}-01`)
      .lt('service_visits.data_execucao' as never, periodoFim)
      .order('id')
      .range(from, to),
  )

  // Receita do período em tempo real — closing.total_receita_unetvale só é
  // preenchido na aprovação do fechamento.
  const { rows: receitaRows } = await fetchAllPages((from, to) =>
    supabase
      .from('service_visits')
      .select('valor_recebido_unetvale')
      .eq('tenant_id', user.tenantId!)
      .eq('fora_escopo', false)
      .gte('data_execucao', `${periodo}-01`)
      .lt('data_execucao', periodoFim)
      .order('id')
      .range(from, to),
  )
  const receitaPeriodo = (receitaRows as { valor_recebido_unetvale: string | null }[]).reduce(
    (sum, r) => {
      const v = Number(r.valor_recebido_unetvale ?? 0)
      return sum + (isNaN(v) ? 0 : v)
    },
    0,
  )

  const payouts = (payoutsRaw ?? []) as PayoutRow[]

  // Conferência dos técnicos (Sprint 18): status por técnico + contestações abertas.
  const [{ data: reviewsRaw }, { data: contestacoesRaw }] = await Promise.all([
    supabase
      .from('closing_technician_reviews')
      .select('technician_id, status, reviewed_at, technicians(nome_completo)')
      .eq('tenant_id', user.tenantId!)
      .eq('periodo', periodo),
    supabase
      .from('payout_contestacoes')
      .select('id, motivo, created_at, payout_id, technician_id, technicians(nome_completo)')
      .eq('tenant_id', user.tenantId!)
      .eq('periodo', periodo)
      .eq('status', 'aberta')
      .order('created_at', { ascending: true }),
  ])

  const nomeFrom = (t: unknown): string => {
    const o = Array.isArray(t) ? t[0] : t
    return (o as { nome_completo?: string } | null)?.nome_completo ?? '—'
  }
  const osByPayout = new Map<string, number>()
  const valorByPayout = new Map<string, number>()
  for (const p of payouts) {
    const sv = p.service_visits as unknown as { os_num?: number } | null
    if (sv?.os_num != null) osByPayout.set(p.id, sv.os_num)
    valorByPayout.set(p.id, getValorEfetivo(p))
  }
  const reviews = (reviewsRaw ?? []).map((r) => ({
    tecnico: nomeFrom((r as { technicians: unknown }).technicians),
    status: (r as { status: string }).status as 'pendente' | 'aprovado' | 'contestado',
  }))
  const contestacoes = (contestacoesRaw ?? []).map((c) => ({
    id: (c as { id: string }).id,
    tecnico: nomeFrom((c as { technicians: unknown }).technicians),
    motivo: (c as { motivo: string }).motivo,
    osNum: osByPayout.get((c as { payout_id: string }).payout_id) ?? null,
    valor: valorByPayout.get((c as { payout_id: string }).payout_id) ?? 0,
  }))

  // Agrupa as contestações abertas por técnico (ambiente mais organizado no fechamento).
  const contestacoesPorTecnico = [
    ...contestacoes.reduce((m, c) => {
      const arr = m.get(c.tecnico) ?? []
      arr.push(c)
      m.set(c.tecnico, arr)
      return m
    }, new Map<string, typeof contestacoes>()),
  ]
    .map(([tecnico, itens]) => ({ tecnico, itens }))
    .sort((a, b) => a.tecnico.localeCompare(b.tecnico))

  const BLOCKING_STATUSES = ['no_rule_match', 'pending_classification', 'conflict']
  const blockers = {
    noRuleMatch: payouts.filter((p) => p.status === 'no_rule_match').length,
    pendingClassification: payouts.filter((p) => p.status === 'pending_classification').length,
    conflict: payouts.filter((p) => p.status === 'conflict').length,
    semTecnico: payouts.filter((p) => !p.technician_id).length,
  }
  const hasBlockers = Object.values(blockers).some((v) => v > 0)

  const periodoLabel = new Date(`${periodo}-01T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })

  // Group payouts by technician
  type TechGroup = {
    id: string
    nome: string
    payouts: PayoutRow[]
    total: number
  }
  const techMap = new Map<string, TechGroup>()
  for (const p of payouts) {
    if (BLOCKING_STATUSES.includes(p.status)) continue
    const sv = p.service_visits as unknown as { tecnico_raw: string | null } | null
    const techId = tecnicoGroupKey(p.technician_id, sv?.tecnico_raw)
    const tech = p.technicians as unknown as { nome_completo: string } | null
    const nome = tecnicoDisplayName(tech?.nome_completo, sv?.tecnico_raw)
    if (!techMap.has(techId)) techMap.set(techId, { id: techId, nome, payouts: [], total: 0 })
    const group = techMap.get(techId)!
    group.payouts.push(p)
    group.total += getValorEfetivo(p)
  }
  const techGroups = [...techMap.values()].sort((a, b) => b.total - a.total)

  const totalEfetivo = techGroups.reduce((sum, g) => sum + g.total, 0)

  const status = closing.status as ClosingStatus
  const canSolicitar = status === 'aberto' || status === 'reaberto'
  const canAprovar = status === 'aguardando_aprovacao'
  const canPagar = status === 'aprovado'
  const canReabrir = status === 'aprovado'

  const solicitarAction = solicitarAprovacao.bind(null, periodo)
  const aprovarAction = aprovarFechamento.bind(null, closing.id)
  const pagarAction = marcarComoPago.bind(null, closing.id)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/fechamento"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Fechamentos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold capitalize text-[var(--text)]">
              {periodoLabel}
            </h1>
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          </div>

          {(status === 'aprovado' || status === 'pago') && (
            <div className="flex gap-2">
              <a
                href={`/fechamento/${periodo}/export/excel`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              >
                Exportar Excel
              </a>
              <a
                href={`/fechamento/${periodo}/export/pdf`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              >
                Exportar PDF
              </a>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Total a Pagar</p>
          <p className="mt-1 text-xl font-bold text-[var(--text)]">{formatBRL(totalEfetivo)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Visitas</p>
          <p className="mt-1 text-xl font-bold text-[var(--text)]">{payouts.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Técnicos</p>
          <p className="mt-1 text-xl font-bold text-[var(--text)]">{techGroups.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">Receita Unetvale</p>
          <p className="mt-1 text-xl font-bold text-[var(--text)]">
            {status === 'aprovado' || status === 'pago'
              ? formatBRL(closing.total_receita_unetvale)
              : formatBRL(receitaPeriodo)}
          </p>
          {status !== 'aprovado' && status !== 'pago' && (
            <p className="mt-0.5 text-[10px] text-[var(--text-3)]">tempo real · consolida na aprovação</p>
          )}
        </div>
      </div>

      {/* Error from redirect */}
      {errorParam && (
        <div className="mb-6 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--red)]" />
            <p className="text-sm text-[var(--red)]">{decodeURIComponent(errorParam)}</p>
          </div>
        </div>
      )}

      {/* Blockers (only when trying to advance) */}
      {canSolicitar && hasBlockers && (
        <div className="mb-6 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--red)]" />
            <p className="text-sm font-semibold text-[var(--red)]">Pendências impedem o fechamento</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-2)]">
            {blockers.noRuleMatch > 0 && (
              <Link href="/pagamentos?status=no_rule_match" className="underline hover:text-[var(--text)]">
                {blockers.noRuleMatch} sem regra LPU
              </Link>
            )}
            {blockers.pendingClassification > 0 && (
              <Link href="/motivos?categoria=pendente_classificacao" className="underline hover:text-[var(--text)]">
                {blockers.pendingClassification} com motivo pendente → classificar
              </Link>
            )}
            {blockers.conflict > 0 && (
              <Link href="/lpu" className="underline hover:text-[var(--text)]">
                {blockers.conflict} com conflito de prioridade → resolver na LPU
              </Link>
            )}
            {blockers.semTecnico > 0 && (
              <Link
                href={`/pagamentos?mes=${periodo}&semTecnico=1`}
                className="underline hover:text-[var(--text)]"
              >
                {blockers.semTecnico} sem técnico vinculado → ver OSs sem técnico
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Conferência dos técnicos (Sprint 18) */}
      {reviews.length > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <Users size={14} className="text-[var(--text-3)]" />
            Conferência dos técnicos
          </p>
          <div className="flex flex-wrap gap-2">
            {reviews.map((r) => {
              const cfg =
                r.status === 'aprovado'
                  ? { txt: 'aprovou', cls: 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]' }
                  : r.status === 'contestado'
                    ? { txt: 'contestou', cls: 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]' }
                    : { txt: 'conferindo', cls: 'bg-[rgba(250,204,21,0.12)] text-yellow-400' }
              return (
                <span
                  key={r.tecnico}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.cls}`}
                >
                  {r.tecnico} · {cfg.txt}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Contestações abertas — voltam para a Wave por técnico */}
      {contestacoes.length > 0 && (
        <div className="mb-6 rounded-xl border border-[rgba(255,181,71,0.3)] bg-[rgba(255,181,71,0.05)] p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--amber)]">
            <MessageSquareWarning size={15} />
            {contestacoes.length} contestação{contestacoes.length !== 1 ? 'ões' : ''} aberta
            {contestacoes.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-4">
            {contestacoesPorTecnico.map((grupo) => (
              <div key={grupo.tecnico}>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[var(--text)]">
                  {grupo.tecnico}
                  <span className="rounded-full bg-[rgba(255,181,71,0.15)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--amber)]">
                    {grupo.itens.length}
                  </span>
                </p>
                <div className="space-y-2 border-l-2 border-[rgba(255,181,71,0.3)] pl-3">
                  {grupo.itens.map((c) => (
                    <div key={c.id} className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-3">
                      {c.osNum != null && (
                        <p className="font-mono text-[12px] font-semibold text-[var(--text-2)]">
                          OS {c.osNum}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] text-[var(--text-2)]">{c.motivo}</p>
                      <ResolverContestacaoForm contestacaoId={c.id} valorAtual={c.valor} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payouts por técnico */}
      <div className="mb-6 overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-1)]">
            <tr>
              {['Técnico', 'Visitas', 'OSs', 'Total a Pagar', ''].map((h) => (
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
            {techGroups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-3)]">
                  Nenhum pagamento elegível neste período.
                </td>
              </tr>
            ) : (
              techGroups.map((g) => (
                <tr key={g.nome} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{g.nome}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-3)]">{g.payouts.length}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                    {new Set(g.payouts.map((p) => {
                      const sv = p.service_visits as unknown as { os_num: number } | null
                      return sv?.os_num
                    })).size}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--text)]">
                    {formatBRL(g.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(status === 'aprovado' || status === 'pago') &&
                      !g.id.startsWith('raw:') &&
                      g.id !== '__sem_tecnico__' && (
                      <a
                        href={`/fechamento/${periodo}/export/pdf/${g.id}`}
                        className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                      >
                        PDF →
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {canSolicitar && (
          <form action={solicitarAction}>
            <Button type="submit" disabled={hasBlockers || payouts.length === 0}>
              {payouts.length === 0
                ? 'Nenhum payout no período'
                : hasBlockers
                  ? 'Resolver pendências antes de fechar'
                  : 'Solicitar aprovação'}
            </Button>
          </form>
        )}

        {canAprovar && (
          <form action={aprovarAction}>
            <Button type="submit" className="bg-[var(--green)] text-[var(--bg)] hover:bg-[var(--green)]/90">
              Aprovar fechamento
            </Button>
          </form>
        )}

        {canPagar && (
          <form action={pagarAction}>
            <Button type="submit" className="bg-[var(--green)] text-[var(--bg)] hover:bg-[var(--green)]/90">
              Marcar como pago
            </Button>
          </form>
        )}

        {canReabrir && (
          <div className="w-full max-w-sm rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
            <p className="mb-3 text-sm font-semibold text-yellow-400">Reabrir fechamento</p>
            <ReopenForm closingId={closing.id} />
          </div>
        )}
      </div>
    </div>
  )
}
