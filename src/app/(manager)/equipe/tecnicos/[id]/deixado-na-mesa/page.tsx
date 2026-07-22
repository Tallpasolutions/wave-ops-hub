import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../../../../_lib/period'
import { getEffectivePeriod } from '../../../../_lib/period-server'

export const metadata: Metadata = { title: 'Deixado na mesa' }
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
}

type Reason = { motivo_normalizado: string | null; motivo_original: string } | null

type Row = {
  valor_deixado_na_mesa: string | number | null
  service_visits: {
    id: string
    os_num: number | string
    data_execucao: string
    finalidade: string | null
    cidade: string | null
    reasons: Reason | Reason[]
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function firstReason(r: Reason | Reason[]): Reason {
  return Array.isArray(r) ? (r[0] ?? null) : r
}

export default async function DeixadoNaMesaPage({ params, searchParams }: Props) {
  const { id } = await params
  const { mes } = await searchParams

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const mesEfetivo = await getEffectivePeriod(mes, supabase, user.tenantId!)
  const { start, end, label: periodoLabel } = parsePeriod(mesEfetivo)

  const [{ data: tech }, { data: rowsRaw }] = await Promise.all([
    supabase
      .from('technicians')
      .select('id, nome_completo')
      .eq('id', id)
      .eq('tenant_id', user.tenantId!)
      .single(),
    // Payouts com valor deixado na mesa > 0 no período (join pela data da visita).
    supabase
      .from('payouts')
      .select(
        'valor_deixado_na_mesa, service_visits!inner(id, os_num, data_execucao, finalidade, cidade, reasons(motivo_normalizado, motivo_original))',
      )
      .eq('tenant_id', user.tenantId!)
      .eq('technician_id', id)
      .gt('valor_deixado_na_mesa', 0)
      .gte('service_visits.data_execucao', start)
      .lt('service_visits.data_execucao', end)
      .order('valor_deixado_na_mesa', { ascending: false }),
  ])

  if (!tech) notFound()

  const rows = (rowsRaw ?? []) as unknown as Row[]
  const total = rows.reduce((sum, r) => sum + Number(r.valor_deixado_na_mesa ?? 0), 0)

  return (
    <div className="p-4 lg:p-8">
      <Link
        href={`/equipe/tecnicos/${id}?mes=${mesEfetivo}`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={14} />
        {tech.nome_completo}
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Deixado na mesa</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Valor de payout perdido por falha atribuível ao técnico · {periodoLabel}
        </p>
        <p className="mt-3 text-3xl font-bold text-[var(--red)]">{formatBRL(total)}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nada deixado na mesa"
          description="Este técnico não perdeu valor por falha própria no período selecionado."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full">
            <thead className="bg-[var(--bg-1)]">
              <tr>
                {['Data', 'OS', 'Finalidade', 'Cidade', 'Motivo', 'Deixado na mesa'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)] ${
                      h === 'Deixado na mesa' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
              {rows.map((r) => {
                const v = r.service_visits
                const reason = firstReason(v.reasons)
                return (
                  <tr key={v.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                      {new Date(v.data_execucao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-[var(--text)]">
                      <Link href={`/oss/${v.os_num}`} className="hover:text-[var(--cyan)] transition-colors">
                        {v.os_num}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">{v.finalidade ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">{v.cidade ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                      {reason ? (reason.motivo_normalizado ?? reason.motivo_original) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[var(--red)] tabular-nums">
                      {formatBRL(Number(r.valor_deixado_na_mesa ?? 0))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
