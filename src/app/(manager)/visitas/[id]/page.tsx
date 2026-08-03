import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { lpuFromEmbed, tabelaPrecoDetalhe } from '@/lib/lpu/tabela-preco'
import { formatPayout } from '@/lib/lpu/format'
import type { PayoutNarrowed } from '@/lib/lpu/types'
import { campoLabel, CAMPOS_OCULTOS_AUDITORIA } from '@/lib/labels/campos'
import { payoutStatusLabel } from '@/lib/labels/payout-status'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Detalhe da Visita' }

type Props = {
  params: Promise<{ id: string }>
}

function formatBRL(value: number | null): string {
  if (value === null || isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0">
      <span className="text-sm text-[var(--text-3)]">{label}</span>
      <span className="text-right text-sm text-[var(--text)]">{value ?? '—'}</span>
    </div>
  )
}

function PayoutStatusBadge({ status }: { status: string }) {
  const { detalhado: label, cls } = payoutStatusLabel(status)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

const LOCKED_STATUSES = ['approved', 'paid']

export default async function VisitDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: visit }, { data: auditRaw }] = await Promise.all([
    supabase
      .from('service_visits')
      .select(
        `id, os_num, data_execucao, sucesso, improdutiva, cidade, finalidade,
         tipo_atendimento, valor_recebido_unetvale, explicacao_valor, tecnico_raw, condominio,
         garantia, validada, agregada, rejeitada, agendada,
         observacoes,
         technicians(id, nome_completo),
         reasons(motivo_original, motivo_normalizado, categoria),
         payouts(id, status, valor_calculado, valor_override, valor_deixado_na_mesa,
                 override_motivo, acrescimo_dom_feriado, lpus(nome, ativa),
                 lpu_rules(description, conditions, payout))`,
      )
      .eq('id', id)
      .eq('tenant_id', user.tenantId!)
      .single(),
    supabase
      .from('service_visits_audit')
      .select('id, changed_at, before, after')
      .eq('visit_id', id)
      .order('changed_at', { ascending: false })
      .limit(20),
  ])

  if (!visit) notFound()

  const tech = visit.technicians as unknown as { id: string; nome_completo: string } | null
  const reason = visit.reasons as unknown as {
    motivo_original: string
    motivo_normalizado: string | null
    categoria: string
  } | null
  const payout = visit.payouts as unknown as {
    id: string
    status: string
    valor_calculado: string | null
    valor_override: string | null
    valor_deixado_na_mesa: string | null
    override_motivo: string | null
    acrescimo_dom_feriado: string | null
    lpus: unknown
    lpu_rules: { description: string | null; conditions: unknown; payout: unknown } | null
  } | null

  // ADR-014: tabela de preços que pagou esta visita (padrão do tenant ou alternativa do técnico)
  const lpuDaPayout = lpuFromEmbed(payout?.lpus)

  const valorCalculado = payout?.valor_calculado !== null ? Number(payout?.valor_calculado) : null
  const valorOverride = payout?.valor_override !== null ? Number(payout?.valor_override) : null
  const valorEfetivo = valorOverride ?? valorCalculado
  const deixadoNaMesa = payout ? Number(payout.valor_deixado_na_mesa ?? 0) : 0
  // ADR-011: acréscimo de domingo/feriado embutido no valor calculado. base = calculado − acréscimo.
  const acrescimoDomFeriado =
    payout?.acrescimo_dom_feriado != null ? Number(payout.acrescimo_dom_feriado) : null
  const temAcrescimo =
    acrescimoDomFeriado !== null && acrescimoDomFeriado > 0 && valorCalculado !== null
  const valorBase = temAcrescimo ? valorCalculado! - acrescimoDomFeriado! : null
  const pctAcrescimo =
    temAcrescimo && valorBase! > 0 ? Math.round((acrescimoDomFeriado! / valorBase!) * 100) : null
  const canOverride = payout && !LOCKED_STATUSES.includes(payout.status)
  // ADR-020: sem receita da Unetvale não há repasse automático. Explicita o motivo do R$ 0,00
  // para o gestor, que é quem responde a contestação do técnico sobre esta visita.
  const semRepassePorReceitaZerada =
    !!payout &&
    valorOverride === null &&
    valorCalculado === 0 &&
    visit.valor_recebido_unetvale !== null &&
    Number(visit.valor_recebido_unetvale) === 0 &&
    (visit.sucesso as string | null)?.trim().toLowerCase().startsWith('sim') === true

  const auditEntries = (auditRaw ?? []) as Array<{
    id: string
    changed_at: string
    before: Record<string, unknown>
    after: Record<string, unknown>
  }>

  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Link
        href={`/oss/${visit.os_num}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} />
        OS {visit.os_num}
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">
            Visita · OS {visit.os_num}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {new Date(visit.data_execucao).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        {canOverride && (
          <Link href={`/pagamentos/${payout!.id}/override`}>
            <Button size="sm" variant="outline">
              Ajustar valor
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dados da visita */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Dados da visita
          </p>
          <InfoRow
            label="Técnico"
            value={
              tech ? (
                <Link
                  href={`/equipe/tecnicos/${tech.id}`}
                  className="text-[var(--cyan)] hover:underline"
                >
                  {tech.nome_completo}
                </Link>
              ) : (
                visit.tecnico_raw ?? '—'
              )
            }
          />
          <InfoRow label="Finalidade" value={visit.finalidade} />
          <InfoRow label="Tipo de atendimento" value={visit.tipo_atendimento} />
          <InfoRow label="Cidade" value={visit.cidade} />
          <InfoRow label="Sucesso" value={visit.sucesso} />
          {reason && (
            <InfoRow
              label="Motivo"
              value={
                <Link href="/motivos" className="text-[var(--text-2)] hover:text-[var(--cyan)]">
                  {reason.motivo_normalizado ?? reason.motivo_original}
                </Link>
              }
            />
          )}
          <InfoRow
            label="Receita Unetvale"
            value={formatBRL(Number(visit.valor_recebido_unetvale ?? 0))}
          />
          {visit.explicacao_valor && (
            <InfoRow label="Explicação do valor" value={visit.explicacao_valor} />
          )}
          {visit.condominio && <InfoRow label="Condomínio" value="Sim" />}
          {visit.garantia && <InfoRow label="Garantia" value="Sim" />}
          {visit.observacoes && <InfoRow label="Observações" value={visit.observacoes} />}
        </div>

        {/* Payout */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Pagamento
          </p>
          {!payout ? (
            <p className="text-sm text-[var(--text-3)]">Pagamento ainda não calculado para esta visita.</p>
          ) : (
            <>
              <InfoRow
                label="Status"
                value={
                  <Link href={`/pagamentos/${payout.id}`}>
                    <PayoutStatusBadge status={payout.status} />
                  </Link>
                }
              />
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
                  value={<span className="text-yellow-400">{formatBRL(valorOverride)}</span>}
                />
              )}
              <InfoRow
                label="Valor efetivo"
                value={
                  <span className="font-semibold text-[var(--text)]">
                    {formatBRL(isNaN(valorEfetivo!) ? null : valorEfetivo)}
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
              {semRepassePorReceitaZerada && (
                <p className="mt-4 rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-xs text-[var(--text-3)]">
                  Sem repasse automático: a Unetvale não pagou nada por esta visita. Se o técnico
                  entender que deve receber, ele contesta pelo aplicativo e a Wave decide aqui.
                </p>
              )}
              {payout.lpu_rules && (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <p className="mb-2 text-xs font-semibold text-[var(--text-3)]">Regra LPU aplicada</p>
                  <p className="mb-2 text-xs text-[var(--text-3)]">
                    Tabela de preços:{' '}
                    <span className="text-[var(--text-2)]">{tabelaPrecoDetalhe(lpuDaPayout)}</span>
                  </p>
                  {payout.lpu_rules.description && (
                    <p className="mb-2 text-sm text-[var(--text-2)]">{payout.lpu_rules.description}</p>
                  )}
                  <p className="text-sm text-[var(--text-2)]">
                    {formatPayout(payout.lpu_rules.payout as PayoutNarrowed)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Auditoria */}
        {auditEntries.length > 0 && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:col-span-2">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Histórico de alterações
            </p>
            <div className="space-y-3">
              {auditEntries.map((entry) => {
                const diffs: { label: string; before: unknown; after: unknown }[] = []
                const allKeys = new Set([...Object.keys(entry.before), ...Object.keys(entry.after)])
                for (const key of allKeys) {
                  if (CAMPOS_OCULTOS_AUDITORIA.has(key)) continue
                  if (JSON.stringify(entry.before[key]) !== JSON.stringify(entry.after[key])) {
                    diffs.push({
                      label: campoLabel(key),
                      before: entry.before[key],
                      after: entry.after[key],
                    })
                  }
                }
                if (diffs.length === 0) return null
                return (
                  <div key={entry.id} className="overflow-hidden rounded-lg border border-[var(--line)]">
                    <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2">
                      <span className="text-xs font-semibold text-[var(--text-2)]">
                        {diffs.length} campo{diffs.length !== 1 ? 's' : ''} alterado{diffs.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-[var(--text-3)]">
                        {new Date(entry.changed_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {diffs.map((d, i) => (
                          <tr key={i} className="border-b border-[var(--line)] last:border-0">
                            <td className="px-4 py-2 text-[var(--text-3)]">{d.label}</td>
                            <td className="px-4 py-2 font-mono text-[var(--red)]">
                              {d.before === null || d.before === undefined ? '—' : String(d.before)}
                            </td>
                            <td className="px-4 py-2 font-mono text-[var(--green)]">
                              {d.after === null || d.after === undefined ? '—' : String(d.after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
