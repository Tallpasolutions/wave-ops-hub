'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { reabrirFechamento } from '../../actions'

type Props = {
  closingId: string
}

export function ReopenForm({ closingId }: Props) {
  const [state, formAction, pending] = useActionState(
    reabrirFechamento.bind(null, closingId),
    { error: null },
  )

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="motivo"
        rows={3}
        required
        minLength={20}
        placeholder="Descreva o motivo da reabertura (mínimo 20 caracteres)..."
        className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      {state.error && (
        <p className="rounded-lg bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={pending} className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10">
        {pending ? 'Reabrindo...' : 'Reabrir fechamento'}
      </Button>
    </form>
  )
}
