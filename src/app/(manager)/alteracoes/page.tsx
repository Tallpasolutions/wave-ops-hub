import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/EmptyState'
import { CienteButton } from './_components/CienteButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Alterações da Unetvale' }

type Row = {
  id: string
  os_num: number
  visit_id: string
  observacao_unetvale: string | null
  receita_anterior: number | string | null
  receita_nova: number | string | null
  payout_anterior: number | string | null
  payout_novo: number | string | null
  ciente_em: string | null
  created_at: string
  technicians: { nome_completo: string } | null
  service_visits: { data_execucao: string } | null
}

const brl = (n: number | string | null) =>
  n === null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface PageProps {
  searchParams: Promise<{ filtro?: string }>
}

export default async function AlteracoesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user?.tenantId) return null

  const { filtro } = await searchParams
  const verTodas = filtro === 'todas'

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('unetvale_alteracoes')
    .select(
      'id, os_num, visit_id, observacao_unetvale, receita_anterior, receita_nova, payout_anterior, payout_novo, ciente_em, created_at, technicians(nome_completo), service_visits(data_execucao)',
    )
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })

  if (!verTodas) query = query.is('ciente_em', null)

  const { data, error } = await query
  if (error) console.error('[alteracoes]', error)
  const rows = (data ?? []) as unknown as Row[]

  const { count: pendentes } = await supabase
    .from('unetvale_alteracoes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .is('ciente_em', null)

  const totalDiferenca = rows.reduce(
    (acc, r) => acc + (Number(r.receita_nova ?? 0) - Number(r.receita_anterior ?? 0)),
    0,
  )

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Alterações da Unetvale
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-2)]">
          OSs em que a Unetvale mudou o valor <strong>depois</strong> de já ter informado outro,
          por abertura de OS de garantia. O sistema não altera o pagamento do técnico sozinho: se
          o valor dele precisar mudar, use o ajuste em Pagamentos. Marcar <strong>Ciente</strong>
          só tira a linha desta fila.
          {(pendentes ?? 0) > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-[rgba(255,84,112,0.13)] px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
              {pendentes} sem ciência
            </span>
          )}
        </p>
        <div className="mt-4 flex gap-2 text-xs">
          <Link
            href="/alteracoes"
            className={`rounded-lg border px-3 py-1.5 transition-colors ${
              verTodas
                ? 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]'
                : 'border-[var(--cyan)]/40 bg-[var(--cyan)]/10 font-semibold text-[var(--cyan)]'
            }`}
          >
            Sem ciência
          </Link>
          <Link
            href="/alteracoes?filtro=todas"
            className={`rounded-lg border px-3 py-1.5 transition-colors ${
              verTodas
                ? 'border-[var(--cyan)]/40 bg-[var(--cyan)]/10 font-semibold text-[var(--cyan)]'
                : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]'
            }`}
          >
            Todas
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={AlertTriangle}
          title={verTodas ? 'Nenhuma alteração registrada' : 'Nada pendente de ciência'}
          description="Quando a Unetvale alterar o valor de uma OS por abertura de OS de garantia, ela aparece aqui."
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--text-3)]">
            {rows.length} {rows.length === 1 ? 'alteração' : 'alterações'} · diferença na receita{' '}
            <span className="font-mono font-semibold text-[var(--red)]">
              {brl(totalDiferenca)}
            </span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-1)] text-left text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                  <th className="px-4 py-3 font-semibold">OS</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Técnico</th>
                  <th className="px-4 py-3 font-semibold">Receita Unetvale</th>
                  <th className="px-4 py-3 font-semibold">Pagamento do técnico</th>
                  <th className="px-4 py-3 font-semibold">Motivo informado pela Unetvale</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pagamentoMudou =
                    Math.round(Number(r.payout_anterior ?? 0) * 100) !==
                    Math.round(Number(r.payout_novo ?? 0) * 100)
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--line)] last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/visitas/${r.visit_id}`}
                          className="font-mono font-semibold text-[var(--cyan)] hover:underline"
                        >
                          {r.os_num}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-3)]">
                        {fmtData(r.service_visits?.data_execucao)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-2)]">
                        {r.technicians?.nome_completo ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <span className="text-[var(--text-3)] line-through">
                          {brl(r.receita_anterior)}
                        </span>
                        <span className="mx-1.5 text-[var(--text-3)]">→</span>
                        <span className="font-semibold text-[var(--red)]">
                          {brl(r.receita_nova)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {pagamentoMudou ? (
                          <>
                            <span className="text-[var(--text-3)] line-through">
                              {brl(r.payout_anterior)}
                            </span>
                            <span className="mx-1.5 text-[var(--text-3)]">→</span>
                            <span className="font-semibold text-[var(--amber)]">
                              {brl(r.payout_novo)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--text-3)]">
                            {brl(r.payout_anterior)} · não mudou
                          </span>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs text-[var(--text-3)]">
                        {r.observacao_unetvale ?? 'Sem descrição na planilha'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.ciente_em ? (
                          <span className="text-[11px] text-[var(--green)]">
                            Ciente em {fmtData(r.ciente_em)}
                          </span>
                        ) : (
                          <CienteButton id={r.id} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
