import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'LPUs' }
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

function StatusBadge({ ativa }: { ativa: boolean }) {
  if (ativa) {
    return (
      <span className="inline-flex items-center rounded-full bg-[rgba(46,230,168,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--green)]">
        Ativa
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--text-3)]">
      Rascunho
    </span>
  )
}

function formatVigencia(inicio: string, fim: string | null): string {
  const start = new Date(inicio + 'T00:00:00').toLocaleDateString('pt-BR')
  if (!fim) return `${start} → vigente`
  const end = new Date(fim + 'T00:00:00').toLocaleDateString('pt-BR')
  return `${start} → ${end}`
}

export default async function LpuPage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: lpus } = await supabase
    .from('lpus')
    .select('id, nome, vigencia_inicio, vigencia_fim, ativa, created_at')
    .eq('tenant_id', user.tenantId!)
    .order('vigencia_inicio', { ascending: false })

  const activeLpu = lpus?.find((l) => l.ativa) ?? null
  const historyLpus = lpus?.filter((l) => !l.ativa) ?? []

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">LPU</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">Lista de Preços Unitários</p>
        </div>
        <Link href="/lpu/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={14} />
            Nova LPU
          </Button>
        </Link>
      </div>

      {/* LPU ativa em destaque */}
      {activeLpu && (
        <div className="mb-6">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Em vigor
          </p>
          <div className="rounded-xl border border-[var(--cyan)] bg-[var(--bg-1)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-display text-lg font-semibold text-[var(--text)]">
                    {activeLpu.nome}
                  </span>
                  <StatusBadge ativa />
                </div>
                <p className="text-sm text-[var(--text-3)]">
                  {formatVigencia(activeLpu.vigencia_inicio, activeLpu.vigencia_fim)}
                </p>
              </div>
              <Link href={`/lpu/${activeLpu.id}`}>
                <Button variant="outline" size="sm">
                  Ver regras
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historyLpus.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {activeLpu ? 'Histórico' : 'LPUs'}
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-1)]">
                <tr>
                  {['Nome', 'Vigência', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-[var(--bg)] divide-y divide-[var(--line)]">
                {historyLpus.map((lpu) => (
                  <tr key={lpu.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                      {lpu.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                      {formatVigencia(lpu.vigencia_inicio, lpu.vigencia_fim)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge ativa={lpu.ativa} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/lpu/${lpu.id}`}
                        className="text-xs font-medium text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
                      >
                        Ver regras
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeLpu && historyLpus.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] py-16">
          <p className="mb-4 text-sm text-[var(--text-3)]">
            Nenhuma LPU cadastrada ainda.
          </p>
          <Link href="/lpu/new">
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              Criar primeira LPU
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
