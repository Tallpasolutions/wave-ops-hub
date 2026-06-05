import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

  const { data: payoutsRaw } = await supabase
    .from('payouts')
    .select(
      `id, status, valor_calculado, valor_override, technician_id,
       technicians(nome),
       service_visits(os_num, data_execucao, finalidade)`,
    )
    .eq('tenant_id', user.tenantId!)
    .gte('service_visits.data_execucao' as never, `${periodo}-01`)
    .lt(
      'service_visits.data_execucao' as never,
      (() => {
        const [y, m] = periodo.split('-').map(Number)
        return new Date(y, m, 1).toISOString().slice(0, 10)
      })(),
    )

  const payouts = (payoutsRaw ?? []) as PayoutRow[]

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
    const techId = p.technician_id ?? 'sem_tecnico'
    const tech = p.technicians as unknown as { nome: string } | null
    const nome = tech?.nome ?? 'Sem técnico'
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
          <p className="mt-1 text-xl font-bold text-[var(--text)]">{formatBRL(closing.total_receita_unetvale)}</p>
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
              <Link href="/uploads" className="underline hover:text-[var(--text)]">
                {blockers.semTecnico} sem técnico vinculado → vincular no upload
              </Link>
            )}
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
                  Nenhum payout elegível neste período.
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
                    {(status === 'aprovado' || status === 'pago') && (
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
            <Button type="submit" disabled={hasBlockers}>
              {hasBlockers ? 'Resolver pendências antes de fechar' : 'Solicitar aprovação'}
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
