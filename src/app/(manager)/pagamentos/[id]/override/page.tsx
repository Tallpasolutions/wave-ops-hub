import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { OverridePayoutForm } from './_components/OverridePayoutForm'

type Props = {
  params: Promise<{ id: string }>
}

const LOCKED_STATUSES = ['approved', 'paid']

export default async function OverridePayoutPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const { data: payout } = await supabase
    .from('payouts')
    .select(
      'id, status, valor_calculado, service_visits(os_num), technicians(nome)',
    )
    .eq('id', id)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!payout || LOCKED_STATUSES.includes(payout.status)) notFound()

  const visit = payout.service_visits as unknown as { os_num: number } | null
  const tech = payout.technicians as unknown as { nome: string } | null
  const valorCalculado = payout.valor_calculado !== null ? Number(payout.valor_calculado) : null

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href={`/pagamentos/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Voltar ao payout
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Override Manual</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          OS {visit?.os_num ?? '—'} · {tech?.nome ?? 'Sem técnico'}
        </p>
      </div>

      <div className="max-w-md">
        <div className="mb-6 rounded-xl border border-[rgba(250,204,21,0.3)] bg-[rgba(250,204,21,0.06)] p-4">
          <p className="text-sm text-yellow-400">
            O valor calculado será preservado para auditoria. O motivo do override é obrigatório.
          </p>
        </div>
        <OverridePayoutForm payoutId={id} valorAtual={valorCalculado} />
      </div>
    </div>
  )
}
