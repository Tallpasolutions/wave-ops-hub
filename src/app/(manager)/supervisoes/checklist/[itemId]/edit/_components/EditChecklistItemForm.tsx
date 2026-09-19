'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { updateChecklistItem } from '../../../actions'
import { ChecklistItemFields } from '../../../_components/ChecklistItemFields'
import type { ValoresItem } from '../../../_components/ChecklistItemFields'

type Props = { itemId: string; valores: ValoresItem; ativo: boolean }

export function EditChecklistItemForm({ itemId, valores, ativo }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateChecklistItem.bind(null, itemId),
    { error: null as string | null, success: false },
  )

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {!ativo && (
        <p className="rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-2.5 text-sm text-[var(--text-2)]">
          Este item está desativado: não entra em supervisões novas. As alterações ficam
          guardadas e valem se você reativá-lo.
        </p>
      )}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
        <ChecklistItemFields valores={valores} />
      </section>

      {state.error && <p className="text-sm text-[var(--red)]">{state.error}</p>}
      {state.success && !state.error && (
        <p className="text-sm text-[var(--green)]">Alterações salvas.</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
        <Link
          href="/supervisoes/checklist"
          className="text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          Voltar
        </Link>
      </div>
    </form>
  )
}
