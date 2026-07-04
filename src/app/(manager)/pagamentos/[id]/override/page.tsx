import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { tecnicoDisplayName } from '@/lib/format/tecnico'
import type { Metadata } from 'next'
import { OverridePayoutForm } from './_components/OverridePayoutForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Override Manual' }

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
      'id, status, valor_calculado, service_visits(os_num, tecnico_raw), technicians(nome_completo)',
    )
    .eq('id', id)
    .eq('tenant_id', user.tenantId!)
    .single()

  if (!payout || LOCKED_STATUSES.includes(payout.status)) notFound()

  const visit = payout.service_visits as unknown as { os_num: number; tecnico_raw: string | null } | null
  const tech = payout.technicians as unknown as { nome_completo: string } | null
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
          OS {visit?.os_num ?? '—'} · {tecnicoDisplayName(tech?.nome_completo, visit?.tecnico_raw)}
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
