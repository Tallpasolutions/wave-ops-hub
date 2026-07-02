import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ osNum: string }> }): Promise<Metadata> {
  const { osNum } = await params
  return { title: `OS ${osNum}` }
}

type Props = {
  params: Promise<{ osNum: string }>
}

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

function formatBRL(value: number | null): string {
  if (value === null || isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function VisitStatusIcon({ sucesso }: { sucesso: string | null }) {
  if (isSuccess(sucesso)) return <CheckCircle size={16} className="shrink-0 text-[var(--green)]" />
  if (sucesso?.toLowerCase().includes('improdut'))
    return <AlertCircle size={16} className="shrink-0 text-yellow-400" />
  return <XCircle size={16} className="shrink-0 text-[var(--red)]" />
}

function PayoutStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_review: { label: 'Aguardando', cls: 'text-[var(--text-3)]' },
    pending: { label: 'Pendente', cls: 'text-[var(--text-2)]' },
    approved: { label: 'Aprovado', cls: 'text-[var(--green)]' },
    paid: { label: 'Pago', cls: 'text-[var(--green)]' },
    override: { label: 'Override', cls: 'text-yellow-400' },
    no_rule_match: { label: 'Sem regra', cls: 'text-[var(--red)]' },
    pending_classification: { label: 'Motivo pendente', cls: 'text-[var(--red)]' },
    conflict: { label: 'Conflito', cls: 'text-[var(--red)]' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'text-[var(--text-3)]' }
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>
}

export default async function OsDetailPage({ params }: Props) {
  const { osNum: osNumStr } = await params
  const osNumParsed = parseInt(osNumStr, 10)
  if (isNaN(osNumParsed)) notFound()

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: visitsRaw }, { data: ordemRaw }] = await Promise.all([
    supabase
      .from('service_visits')
      .select(
        `id, data_execucao, sucesso, cidade, finalidade, tipo_atendimento,
         valor_recebido_unetvale, tecnico_raw,
         technicians(id, nome_completo),
         reasons(motivo_original, motivo_normalizado, categoria),
         payouts(id, status, valor_calculado, valor_override, valor_deixado_na_mesa)`,
      )
      .eq('tenant_id', user.tenantId!)
      .eq('os_num', osNumParsed)
      .order('data_execucao', { ascending: true }),
    supabase
      .from('service_orders')
      .select('cliente_usuario, contrato, status_consolidado, receita_total, custo_total')
      .eq('tenant_id', user.tenantId!)
      .eq('os_num', osNumParsed)
      .maybeSingle(),
  ])

  const visits = visitsRaw ?? []
  if (visits.length === 0) notFound()

  const ordem = ordemRaw

  const primeiraVisita = visits[0]
  const finalidade = primeiraVisita.finalidade
  const cidade = primeiraVisita.cidade
  const osResolvida = visits.some((v) => isSuccess(v.sucesso))
  const totalReceita = visits.reduce((s, v) => s + Number(v.valor_recebido_unetvale ?? 0), 0)

  const visitas_sucesso = visits.filter((v) => isSuccess(v.sucesso))
  const ultimaSucesso = visitas_sucesso[visitas_sucesso.length - 1]

  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Link
        href="/oss"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} />
        OSs
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">OS {osNumParsed}</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {finalidade ?? '—'} · {cidade ?? '—'} · {visits.length} visit
            {visits.length !== 1 ? 'as' : 'a'}
          </p>
        </div>
        <span
          className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            osResolvida
              ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
              : 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]'
          }`}
        >
          {osResolvida ? 'Resolvida' : 'Não resolvida'}
        </span>
      </div>

      {/* Resumo */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Visitas
          </p>
          <p className="mt-0.5 text-xl font-bold text-[var(--text)]">{visits.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Tentativas até resolver
          </p>
          <p className="mt-0.5 text-xl font-bold text-[var(--text)]">
            {osResolvida ? visitas_sucesso.length > 0 ? visits.indexOf(ultimaSucesso!) + 1 : '—' : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Receita total
          </p>
          <p className="mt-0.5 text-xl font-bold text-[var(--cyan)]">{formatBRL(totalReceita)}</p>
        </div>
        {ordem?.cliente_usuario && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Cliente
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">
              {ordem.cliente_usuario}
            </p>
            {ordem.contrato && (
              <p className="text-xs text-[var(--text-3)]">{ordem.contrato}</p>
            )}
          </div>
        )}
      </div>

      {/* Timeline de visitas */}
      <div>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Timeline de visitas
        </p>
        <div className="relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-4 top-0 h-full w-px bg-[var(--line)]" />

          <div className="space-y-4 pl-12">
            {visits.map((v, idx) => {
              const tech = v.technicians as unknown as { id: string; nome_completo: string } | null
              const reason = v.reasons as unknown as {
                motivo_original: string
                motivo_normalizado: string | null
                categoria: string
              } | null
              const payout = v.payouts as unknown as {
                id: string
                status: string
                valor_calculado: string | null
                valor_override: string | null
                valor_deixado_na_mesa: string | null
              } | null

              const valorEfetivo = payout
                ? payout.valor_override !== null
                  ? Number(payout.valor_override)
                  : Number(payout.valor_calculado)
                : null

              const deixadoNaMesa = payout ? Number(payout.valor_deixado_na_mesa ?? 0) : 0
              const success = isSuccess(v.sucesso)
              const isUltimaSucesso = success && ultimaSucesso?.id === v.id

              return (
                <div key={v.id} className="relative">
                  {/* Ícone na linha da timeline */}
                  <div className="absolute -left-[2.15rem] top-3.5">
                    <VisitStatusIcon sucesso={v.sucesso} />
                  </div>

                  <div
                    className={`rounded-xl border bg-[var(--bg-1)] p-4 ${
                      isUltimaSucesso
                        ? 'border-[var(--green)] border-opacity-50'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text-2)]">
                          Visita {idx + 1}
                        </span>
                        <span className="text-xs text-[var(--text-3)]">·</span>
                        <span className="text-xs text-[var(--text-3)]">
                          {new Date(v.data_execucao).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {isUltimaSucesso && (
                          <span className="rounded-full bg-[rgba(46,230,168,0.15)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--green)]">
                            Recebe o valor
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/visitas/${v.id}`}
                        className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                      >
                        Detalhe →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm lg:grid-cols-4">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                          Técnico
                        </span>
                        <p className="mt-0.5 text-[var(--text)]">
                          {tech ? (
                            <Link
                              href={`/equipe/tecnicos/${tech.id}`}
                              className="hover:text-[var(--cyan)] transition-colors"
                            >
                              {tech.nome_completo}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-3)]">{v.tecnico_raw ?? '—'}</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                          Resultado
                        </span>
                        <p className="mt-0.5">
                          <span
                            className={`text-sm font-medium ${
                              success ? 'text-[var(--green)]' : 'text-[var(--text-2)]'
                            }`}
                          >
                            {v.sucesso ?? '—'}
                          </span>
                        </p>
                      </div>
                      {reason && (
                        <div className="col-span-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                            Motivo
                          </span>
                          <p className="mt-0.5 text-[var(--text-2)]">
                            {reason.motivo_normalizado ?? reason.motivo_original}
                          </p>
                        </div>
                      )}
                      {payout && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                            Payout
                          </span>
                          <p className="mt-0.5 flex items-center gap-2">
                            <span className="font-medium text-[var(--text)]">
                              {formatBRL(isNaN(valorEfetivo!) ? null : valorEfetivo)}
                            </span>
                            <Link href={`/pagamentos/${payout.id}`}>
                              <PayoutStatusBadge status={payout.status} />
                            </Link>
                          </p>
                        </div>
                      )}
                      {deixadoNaMesa > 0 && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                            Deixado na mesa
                          </span>
                          <p className="mt-0.5 text-sm text-[var(--red)]">
                            {formatBRL(deixadoNaMesa)}
                          </p>
                        </div>
                      )}
                      {v.valor_recebido_unetvale && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                            Receita Unetvale
                          </span>
                          <p className="mt-0.5 text-sm text-[var(--text-2)]">
                            {formatBRL(Number(v.valor_recebido_unetvale))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
