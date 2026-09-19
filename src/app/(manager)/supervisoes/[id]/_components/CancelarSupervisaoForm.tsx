'use client'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cancelarSupervisao } from '../../actions'

export function CancelarSupervisaoForm({ supervisaoId }: { supervisaoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, isPending] = useActionState(
    cancelarSupervisao.bind(null, supervisaoId),
    { error: null as string | null, success: false },
  )

  if (state.success && !state.error) {
    return <p className="text-sm text-[var(--text-3)]">Supervisão cancelada.</p>
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm text-[var(--text-3)] transition-colors hover:text-[var(--red)]"
      >
        Cancelar supervisão
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="motivo"
        rows={2}
        required
        autoFocus
        placeholder="Por que esta supervisão foi cancelada?"
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]"
      />
      {/* O motivo é obrigatório: supervisão cancelada sem explicação vira um buraco no
          histórico que ninguém consegue reconstruir depois. */}
      {state.error && <p className="text-sm text-[var(--red)]">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} variant="destructive">
          {isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
        </Button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-[var(--text-3)] hover:text-[var(--text)]"
        >
          Voltar
        </button>
      </div>
    </form>
  )
}
