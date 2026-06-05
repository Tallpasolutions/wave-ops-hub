import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Ordens de Serviço' }
import { parsePeriod } from '../_lib/period'
import { EmptyState } from '@/components/EmptyState'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ mes?: string; finalidade?: string; cidade?: string }>
}

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type OsGroup = {
  osNum: number
  finalidade: string | null
  cidade: string | null
  totalVisitas: number
  resolvida: boolean
  receita: number
  ultimaVisita: string
}

function groupByOs(
  visits: Array<{
    os_num: number
    finalidade: string | null
    cidade: string | null
    sucesso: string | null
    data_execucao: string
    valor_recebido_unetvale: string | null
  }>,
): OsGroup[] {
  const map = new Map<number, OsGroup>()

  for (const v of visits) {
    const existing = map.get(v.os_num)
    if (!existing) {
      map.set(v.os_num, {
        osNum: v.os_num,
        finalidade: v.finalidade,
        cidade: v.cidade,
        totalVisitas: 1,
        resolvida: isSuccess(v.sucesso),
        receita: Number(v.valor_recebido_unetvale ?? 0),
        ultimaVisita: v.data_execucao,
      })
    } else {
      existing.totalVisitas++
      existing.receita += Number(v.valor_recebido_unetvale ?? 0)
      if (isSuccess(v.sucesso)) existing.resolvida = true
      if (v.data_execucao > existing.ultimaVisita) {
        existing.ultimaVisita = v.data_execucao
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.ultimaVisita.localeCompare(a.ultimaVisita))
}

export default async function OssPage({ searchParams }: Props) {
  const { mes, finalidade: finalidadeFiltro, cidade: cidadeFiltro } = await searchParams
  const { start, end, label: periodoLabel } = parsePeriod(mes)
  const mesAtual = mes ?? start.slice(0, 7)

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: visitsRaw } = await supabase
    .from('service_visits')
    .select('os_num, finalidade, cidade, sucesso, data_execucao, valor_recebido_unetvale')
    .eq('tenant_id', user.tenantId!)
    .gte('data_execucao', start)
    .lt('data_execucao', end)
    .order('data_execucao', { ascending: false })
    .limit(5000)

  const visits = visitsRaw ?? []
  let osGroups = groupByOs(visits)

  // Filtros client-side após agregação
  if (finalidadeFiltro) {
    osGroups = osGroups.filter((o) => o.finalidade === finalidadeFiltro)
  }
  if (cidadeFiltro) {
    osGroups = osGroups.filter((o) => o.cidade === cidadeFiltro)
  }

  // Opções únicas de filtro
  const allGroups = groupByOs(visits)
  const finalidades = [...new Set(allGroups.map((o) => o.finalidade).filter(Boolean))].sort() as string[]
  const cidades = [...new Set(allGroups.map((o) => o.cidade).filter(Boolean))].sort() as string[]

  const totalReceita = osGroups.reduce((sum, o) => sum + o.receita, 0)
  const totalResolvidas = osGroups.filter((o) => o.resolvida).length

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Ordens de Serviço</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {osGroups.length} OS{osGroups.length !== 1 ? 's' : ''} · {periodoLabel}
        </p>
      </div>

      {/* KPIs rápidos */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Total de OSs
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{osGroups.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Resolvidas
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--green)]">{totalResolvidas}</p>
          <p className="text-xs text-[var(--text-3)]">
            {osGroups.length > 0
              ? Math.round((totalResolvidas / osGroups.length) * 100)
              : 0}
            % do total
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Receita total
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--cyan)]">{formatBRL(totalReceita)}</p>
        </div>
      </div>

      {/* Filtros de finalidade e cidade */}
      {(finalidades.length > 0 || cidades.length > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {finalidades.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="self-center text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                Finalidade:
              </span>
              {[null, ...finalidades].map((f) => {
                const params = new URLSearchParams()
                params.set('mes', mesAtual)
                if (f) params.set('finalidade', f)
                if (cidadeFiltro) params.set('cidade', cidadeFiltro)
                const isActive = (f ?? '') === (finalidadeFiltro ?? '')
                return (
                  <Link
                    key={f ?? 'all'}
                    href={`/oss?${params.toString()}`}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--cyan)] text-[var(--bg)]'
                        : 'bg-white/5 text-[var(--text-2)] hover:bg-white/10'
                    }`}
                  >
                    {f ?? 'Todas'}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      {osGroups.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma OS encontrada"
          description="Faça o upload da planilha para registrar as visitas do período."
          cta={{ label: 'Fazer upload', href: '/uploads/new' }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-1)]">
              <tr>
                {['OS', 'Finalidade', 'Cidade', 'Visitas', 'Status', 'Receita', 'Última visita', ''].map(
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
              {osGroups.map((os) => (
                <tr key={os.osNum} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[var(--text)]">
                    {os.osNum}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                    {os.finalidade ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-3)]">{os.cidade ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-3)]">{os.totalVisitas}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        os.resolvida
                          ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
                          : 'bg-[rgba(239,68,68,0.12)] text-[var(--red)]'
                      }`}
                    >
                      {os.resolvida ? 'Resolvida' : 'Não resolvida'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                    {formatBRL(os.receita)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                    {new Date(os.ultimaVisita).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/oss/${os.osNum}`}
                      className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                    >
                      Detalhe →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
