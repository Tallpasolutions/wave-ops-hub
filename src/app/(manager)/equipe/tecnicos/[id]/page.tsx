import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser, canManageTechnicians } from '@/lib/auth'

export const metadata: Metadata = { title: 'Perfil do Técnico' }
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../../../_lib/period'
import { getEffectivePeriod } from '../../../_lib/period-server'
import { TechnicianAccess } from './_components/TechnicianAccess'
import { TechnicianLpuSelector } from './_components/TechnicianLpuSelector'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
}

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

type EmbeddedPayout = {
  status: string
  valor_calculado: string | number | null
  valor_override: string | number | null
  valor_deixado_na_mesa: string | number | null
}

// PostgREST embute a relação 1:1 (payouts.visit_id é UNIQUE) — dependendo do
// caso pode vir como objeto único ou array de um item.
function getPayout(v: { payouts: unknown }): EmbeddedPayout | null {
  const p = v.payouts
  if (Array.isArray(p)) return (p[0] as EmbeddedPayout) ?? null
  return (p as EmbeddedPayout | null) ?? null
}

// Valor efetivo = override quando existe, senão o calculado. Mesmo critério do
// detalhe da visita.
function effectiveValue(p: EmbeddedPayout | null): number | null {
  if (!p) return null
  const val = p.valor_override !== null ? Number(p.valor_override) : Number(p.valor_calculado ?? 0)
  return isNaN(val) ? null : val
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-[var(--text)]">{value ?? '—'}</p>
    </div>
  )
}

export default async function TechnicianProfilePage({ params, searchParams }: Props) {
  const { id } = await params
  const { mes } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  // Default = último mês com dados (não o mês corrente vazio). Antes o perfil abria em
  // julho vazio mesmo quando o técnico tinha visitas em junho.
  const mesEfetivo = await getEffectivePeriod(mes, supabase, user.tenantId!)
  const { start, end, label: periodoLabel } = parsePeriod(mesEfetivo)

  const [{ data: tech }, { data: visitsRaw }, { data: loginUser }] =
    await Promise.all([
    supabase
      .from('technicians')
      .select('id, nome_completo, email, cpf, celular, codigo_unetvale, ativo, data_admissao, observacoes, lpu_id')
      .eq('id', id)
      .eq('tenant_id', user.tenantId!)
      .single(),
    // Sem limite de linhas: um técnico em um mês fica muito abaixo do teto de 1000
    // do PostgREST. O payout de cada visita vem embutido (relação 1:1 por visit_id),
    // o que também alimenta os KPIs sobre o período completo.
    supabase
      .from('service_visits')
      .select(
        'id, os_num, data_execucao, sucesso, finalidade, cidade, valor_recebido_unetvale, reasons(motivo_normalizado, motivo_original), payouts(status, valor_calculado, valor_override, valor_deixado_na_mesa)',
      )
      .eq('tenant_id', user.tenantId!)
      .eq('fora_escopo', false)
      .eq('tecnico_id', id)
      .gte('data_execucao', start)
      .lt('data_execucao', end)
      .order('data_execucao', { ascending: false }),
    supabase
      .from('users')
      .select('id, email, ativo')
      .eq('tenant_id', user.tenantId!)
      .eq('technician_id', id)
      .eq('role', 'tenant_technician')
      .maybeSingle(),
  ])

  if (!tech) notFound()

  // ADR-014: LPUs do tenant para o seletor de LPU por técnico.
  const { data: lpusData } = await supabase
    .from('lpus')
    .select('id, nome, ativa')
    .eq('tenant_id', user.tenantId!)
    .order('ativa', { ascending: false })
  const lpus = (lpusData ?? []) as { id: string; nome: string; ativa: boolean }[]

  const visits = visitsRaw ?? []

  // KPIs do período
  const totalVisitas = visits.length
  const visitasResolvidas = visits.filter((v) => isSuccess(v.sucesso)).length
  const taxaSucesso = totalVisitas > 0 ? Math.round((visitasResolvidas / totalVisitas) * 100) : 0

  const PAID_STATUSES = new Set(['approved', 'paid', 'override', 'pending_review', 'pending'])
  const totalPago = visits.reduce((sum, v) => {
    const p = getPayout(v)
    if (!p || !PAID_STATUSES.has(p.status)) return sum
    return sum + (effectiveValue(p) ?? 0)
  }, 0)

  const totalDeixadoNaMesa = visits.reduce((sum, v) => {
    const p = getPayout(v)
    return sum + Number(p?.valor_deixado_na_mesa ?? 0)
  }, 0)

  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Link
        href="/equipe/tecnicos"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} />
        Técnicos
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">{tech.nome_completo}</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">{tech.email}</p>
        </div>
        <span
          className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            tech.ativo
              ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
              : 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]'
          }`}
        >
          {tech.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Dados cadastrais */}
      <div className="mb-8 grid grid-cols-2 gap-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:grid-cols-4">
        <InfoItem label="CPF" value={<span className="font-mono">{maskCpf(tech.cpf)}</span>} />
        <InfoItem
          label="Celular"
          value={<span className="font-mono">{tech.celular ?? '—'}</span>}
        />
        <InfoItem
          label="Cód. Unetvale"
          value={<span className="font-mono">{tech.codigo_unetvale ?? '—'}</span>}
        />
        <InfoItem
          label="Admissão"
          value={
            tech.data_admissao
              ? new Date(tech.data_admissao).toLocaleDateString('pt-BR')
              : '—'
          }
        />
        {tech.observacoes && (
          <div className="col-span-2 lg:col-span-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Observações
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-2)]">{tech.observacoes}</p>
          </div>
        )}
      </div>

      {/* Acesso ao portal (login do técnico) */}
      {canManageTechnicians(user) && (
        <TechnicianAccess
          technicianId={tech.id}
          nomeCompleto={tech.nome_completo}
          email={tech.email}
          user={loginUser ?? null}
        />
      )}

      {/* LPU do técnico (ADR-014) */}
      {canManageTechnicians(user) && (
        <TechnicianLpuSelector
          technicianId={tech.id}
          currentLpuId={(tech as { lpu_id: string | null }).lpu_id}
          lpus={lpus}
        />
      )}

      {/* KPIs do período */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Visitas
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{totalVisitas}</p>
          <p className="text-xs text-[var(--text-3)]">{periodoLabel}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Taxa de sucesso
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--green)]">{taxaSucesso}%</p>
          <p className="text-xs text-[var(--text-3)]">
            {visitasResolvidas} de {totalVisitas}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            A pagar
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--cyan)]">{formatBRL(totalPago)}</p>
          <p className="text-xs text-[var(--text-3)]">pagamentos pendentes/aprovados</p>
        </div>
        {totalDeixadoNaMesa > 0 ? (
          <Link
            href={`/equipe/tecnicos/${id}/deixado-na-mesa?mes=${mesEfetivo}`}
            className="group rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4 transition-colors hover:border-[var(--red)]/40 hover:bg-white/[0.02]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Deixado na mesa
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--red)]">
              {formatBRL(totalDeixadoNaMesa)}
            </p>
            <p className="text-xs text-[var(--text-3)] transition-colors group-hover:text-[var(--text-2)]">
              ver OSs →
            </p>
          </Link>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Deixado na mesa
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-3)]">
              {formatBRL(totalDeixadoNaMesa)}
            </p>
            <p className="text-xs text-[var(--text-3)]">falhas atribuíveis ao técnico</p>
          </div>
        )}
      </div>

      {/* Tabela de visitas */}
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Visitas no período
        </p>
        {visits.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma visita registrada"
            description="Este técnico não tem visitas no período selecionado."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <table className="w-full">
              <thead className="bg-[var(--bg-1)]">
                <tr>
                  {['Data', 'OS', 'Finalidade', 'Cidade', 'Resultado', 'Valor', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] ${
                        h === 'Valor' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                {visits.map((v) => {
                  const reason = v.reasons as unknown as {
                    motivo_normalizado: string | null
                    motivo_original: string
                  } | null
                  const success = isSuccess(v.sucesso)
                  const valor = effectiveValue(getPayout(v))
                  return (
                    <tr key={v.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                        {new Date(v.data_execucao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-[var(--text)]">
                        <Link
                          href={`/oss/${v.os_num}`}
                          className="hover:text-[var(--cyan)] transition-colors"
                        >
                          {v.os_num}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                        {v.finalidade ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                        {v.cidade ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${
                            success ? 'text-[var(--green)]' : 'text-[var(--text-3)]'
                          }`}
                        >
                          {success
                            ? 'Resolvida'
                            : reason
                              ? (reason.motivo_normalizado ?? reason.motivo_original)
                              : (v.sucesso ?? '—')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                        <span className={valor ? 'text-[var(--cyan)]' : 'text-[var(--text-3)]'}>
                          {valor !== null ? formatBRL(valor) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/visitas/${v.id}`}
                          className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                        >
                          Detalhe →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
