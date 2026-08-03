'use client'
import { useActionState } from 'react'
import { Check } from 'lucide-react'
import { marcarCiente } from '../actions'

export function CienteButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(marcarCiente, {
    error: null as string | null,
    success: false,
  })

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--cyan)]/40 hover:text-[var(--text)] disabled:opacity-50"
      >
        <Check size={13} />
        {isPending ? 'Registrando…' : 'Ciente'}
      </button>
      {state.error && <span className="text-[11px] text-[var(--red)]">{state.error}</span>}
    </form>
  )
}
