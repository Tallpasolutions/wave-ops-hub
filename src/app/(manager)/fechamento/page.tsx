import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Fechamentos' }

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
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

export default async function FechamentoPage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: closings } = await supabase
    .from('monthly_closings')
    .select('id, periodo, status, total_a_pagar, total_visitas, margem')
    .eq('tenant_id', user.tenantId!)
    .order('periodo', { ascending: false })
    .limit(12)

  const list = closings ?? []

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Fechamento Mensal</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Consolidação e aprovação de payouts por período
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] py-16">
          <p className="text-sm text-[var(--text-3)]">Nenhum fechamento encontrado.</p>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Os fechamentos são criados automaticamente ao calcular payouts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/fechamento/${c.periodo}`}
              className="group rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition-colors hover:border-[var(--cyan)]/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-bold text-[var(--text)]">
                  {new Date(`${c.periodo}-01T12:00:00`).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <StatusBadge status={c.status as ClosingStatus} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Total a pagar
                  </p>
                  <p className="mt-0.5 text-base font-bold text-[var(--text)]">
                    {formatBRL(c.total_a_pagar)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Visitas
                  </p>
                  <p className="mt-0.5 text-base font-bold text-[var(--text)]">
                    {c.total_visitas}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-right text-xs text-[var(--text-3)] transition-colors group-hover:text-[var(--cyan)]">
                Ver detalhes →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
