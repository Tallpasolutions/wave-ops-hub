import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { tecnicoDisplayName } from '@/lib/format/tecnico'
import { lpuFromEmbed, tabelaAlternativaLabel, tabelaPrecoDetalhe } from '@/lib/lpu/tabela-preco'
import { formatConditions, formatPayout } from '@/lib/lpu/format'
import { payoutStatusLabel } from '@/lib/labels/payout-status'
import type { PayoutNarrowed } from '@/lib/lpu/types'

export const metadata: Metadata = { title: 'Detalhe do Pagamento' }
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

function formatBRL(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function StatusBadge({ status }: { status: string }) {
  const { detalhado: label, cls } = payoutStatusLabel(status)
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0">
      <span className="text-sm text-[var(--text-3)]">{label}</span>
      <span className="text-right text-sm text-[var(--text)]">{value}</span>
    </div>
  )
}

const LOCKED_STATUSES = ['approved', 'paid']

export default async function PayoutDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: payout }, { data: auditRaw }] = await Promise.all([
    supabase
      .from('payouts')
      .select(
        `id, status, valor_calculado, valor_override, valor_deixado_na_mesa,
         override_motivo, override_at, approved_at, paid_at, acrescimo_dom_feriado,
         service_visits(os_num, data_execucao, finalidade, sucesso, cidade, condominio, tecnico_raw),
         technicians(nome_completo),
         lpus(nome, ativa),
         lpu_rules(description, conditions, payout),
         reasons(motivo_original, motivo_normalizado, categoria)`,
      )
      .eq('id', id)
      .eq('tenant_id', user.tenantId!)
      .single(),
    supabase
      .from('payouts_audit')
      .select('changed_at, before, after')
      .eq('payout_id', id)
      .order('changed_at', { ascending: false })
      .limit(10),
  ])

  if (!payout) notFound()

  const visit = payout.service_visits as unknown as {
    os_num: number
    data_execucao: string
    finalidade: string | null
    sucesso: string | null
    cidade: string | null
    condominio: boolean | null
    tecnico_raw: string | null
  } | null

  const tech = payout.technicians as unknown as { nome_completo: string } | null
  // ADR-014: qual tabela de preços pagou esta visita (padrão do tenant ou alternativa do técnico)
  const lpuDaPayout = lpuFromEmbed(payout.lpus)
  const rule = payout.lpu_rules as unknown as { description: string | null; conditions: unknown; payout: unknown } | null
  const reason = payout.reasons as unknown as {
    motivo_original: string
    motivo_normalizado: string | null
    categoria: string
  } | null

  const valorCalculado = payout.valor_calculado !== null ? Number(payout.valor_calculado) : null
  const valorOverride = payout.valor_override !== null ? Number(payout.valor_override) : null
  const valorEfetivo = valorOverride ?? valorCalculado
  const deixadoNaMesa = Number(payout.valor_deixado_na_mesa ?? 0)
  // ADR-011: acréscimo de domingo/feriado somado ao valor calculado. base = calculado − acréscimo.
  const acrescimoDomFeriado =
    payout.acrescimo_dom_feriado !== null ? Number(payout.acrescimo_dom_feriado) : null
  const temAcrescimo = acrescimoDomFeriado !== null && acrescimoDomFeriado > 0 && valorCalculado !== null
  const valorBase = temAcrescimo ? valorCalculado! - acrescimoDomFeriado! : null
  const pctAcrescimo =
    temAcrescimo && valorBase! > 0 ? Math.round((acrescimoDomFeriado! / valorBase!) * 100) : null

  const canOverride = !LOCKED_STATUSES.includes(payout.status)

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/pagamentos"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Pagamentos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">
              OS {visit?.os_num ?? '—'}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={payout.status} />
            </div>
          </div>
          {canOverride && (
            <Link href={`/pagamentos/${id}/override`}>
              <Button size="sm" variant="outline">
                Ajustar valor
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Visita */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Dados da Visita
          </p>
          <InfoRow label="OS" value={visit?.os_num ?? '—'} />
          <InfoRow
            label="Data"
            value={
              visit?.data_execucao
                ? new Date(visit.data_execucao).toLocaleDateString('pt-BR')
                : '—'
            }
          />
          <InfoRow label="Técnico" value={tecnicoDisplayName(tech?.nome_completo, visit?.tecnico_raw)} />
          <InfoRow label="Finalidade" value={visit?.finalidade ?? '—'} />
          <InfoRow label="Sucesso" value={visit?.sucesso ?? '—'} />
          <InfoRow label="Cidade" value={visit?.cidade ?? '—'} />
          {reason && (
            <InfoRow
              label="Motivo"
              value={reason.motivo_normalizado ?? reason.motivo_original}
            />
          )}
        </div>

        {/* Financeiro */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Financeiro
          </p>
          {temAcrescimo && (
            <>
              <InfoRow label="Valor base" value={formatBRL(valorBase)} />
              <InfoRow
                label={`Acréscimo domingo/feriado${pctAcrescimo !== null ? ` (+${pctAcrescimo}%)` : ''}`}
                value={<span className="text-[var(--cyan)]">+{formatBRL(acrescimoDomFeriado)}</span>}
              />
            </>
          )}
          <InfoRow label="Valor calculado" value={formatBRL(valorCalculado)} />
          {valorOverride !== null && (
            <InfoRow
              label="Valor ajustado pelo gestor"
              value={
                <span className="text-yellow-400">{formatBRL(valorOverride)}</span>
              }
            />
          )}
          <InfoRow
            label="Valor efetivo"
            value={
              <span className="font-semibold text-[var(--text)]">
                {formatBRL(valorEfetivo)}
              </span>
            }
          />
          {deixadoNaMesa > 0 && (
            <InfoRow
              label="Deixado na mesa"
              value={<span className="text-[var(--red)]">{formatBRL(deixadoNaMesa)}</span>}
            />
          )}
          {payout.override_motivo && (
            <InfoRow label="Motivo do ajuste" value={payout.override_motivo} />
          )}
        </div>

        {/* Regra aplicada */}
        {rule && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:col-span-2">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Regra LPU Aplicada
            </p>
            {/* ADR-014: de qual tabela veio o valor — o gestor precisa saber sem abrir o técnico */}
            <div className="mb-3">
              <p className="mb-1 text-xs text-[var(--text-3)]">Tabela de preços</p>
              <p className="text-sm text-[var(--text)]">
                {tabelaPrecoDetalhe(lpuDaPayout)}
                {tabelaAlternativaLabel(lpuDaPayout) && (
                  <span className="ml-2 rounded bg-[rgba(56,189,248,0.12)] px-2 py-0.5 text-xs text-[var(--cyan)]">
                    tabela alternativa
                  </span>
                )}
              </p>
            </div>
            {rule.description && (
              <p className="mb-3 text-sm text-[var(--text)]">{rule.description}</p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-[var(--text-3)]">
                  A regra se aplica quando
                </p>
                <dl className="space-y-1">
                  {formatConditions(
                    rule.conditions as Parameters<typeof formatConditions>[0],
                  ).map((c) => (
                    <div key={c.campo} className="flex gap-2 text-sm">
                      <dt className="text-[var(--text-3)]">{c.campo}:</dt>
                      <dd className="text-[var(--text-2)]">{c.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="mb-2 text-xs text-[var(--text-3)]">Como o valor é calculado</p>
                <p className="text-sm text-[var(--text-2)]">
                  {formatPayout(rule.payout as PayoutNarrowed)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de auditoria */}
        {auditRaw && auditRaw.length > 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:col-span-2">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Histórico de Auditoria
            </p>
            <div className="space-y-3">
              {auditRaw.map((entry, i) => (
                <div key={i} className="rounded bg-white/5 p-3 text-xs text-[var(--text-3)]">
                  <p className="mb-1 font-semibold text-[var(--text-2)]">
                    {new Date(entry.changed_at).toLocaleString('pt-BR')}
                  </p>
                  <p>
                    Status:{' '}
                    {(entry.before as Record<string, string>)?.status} →{' '}
                    {(entry.after as Record<string, string>)?.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
