import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ReasonCategoria } from '@/db/schema'
import { EditReasonForm } from './_components/EditReasonForm'

type ReasonDetail = {
  id: string
  motivo_original: string
  motivo_normalizado: string
  categoria: ReasonCategoria
  paga_improdutiva: boolean
  valor_improdutiva: string | null
  observacao: string | null
}

export default async function EditReasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data: reason } = await supabase
    .from('reasons')
    .select(
      'id, motivo_original, motivo_normalizado, categoria, paga_improdutiva, valor_improdutiva, observacao',
    )
    .eq('id', id)
    .maybeSingle()

  if (!reason) notFound()

  const r = reason as ReasonDetail

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/motivos"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Motivos
        </Link>

        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Editar Motivo</h1>
        <p className="mt-1 max-w-xl truncate font-mono text-sm text-[var(--text-3)]">
          {r.motivo_original}
        </p>
      </div>

      <div className="max-w-lg">
        <EditReasonForm reason={r} />
      </div>
    </div>
  )
}
