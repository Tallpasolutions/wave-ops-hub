'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createChecklistItem } from '../../actions'
import { ChecklistItemFields } from '../../_components/ChecklistItemFields'

export function CreateChecklistItemForm({ proximaOrdem }: { proximaOrdem: number }) {
  const [state, formAction, isPending] = useActionState(createChecklistItem, {
    error: null as string | null,
  })

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
        <ChecklistItemFields valores={{ ordem: proximaOrdem }} />
      </section>

      {state.error && (
        <p className="text-sm text-[var(--red)]">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Criar item'}
        </Button>
        <Link
          href="/supervisoes/checklist"
          className="text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
