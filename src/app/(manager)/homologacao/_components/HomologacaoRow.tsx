'use client'
import { useActionState } from 'react'
import { classifyHomologacao } from '../actions'

type Props = {
  valorUnetvale: number
  valorAtual: number | null
}

export function HomologacaoRow({ valorUnetvale, valorAtual }: Props) {
  const [state, formAction, isPending] = useActionState(classifyHomologacao, {
    error: null as string | null,
    success: false,
  })

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="valorUnetvale" value={valorUnetvale} />
      <div className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2">
        <span className="text-xs text-[var(--text-3)]">R$</span>
        <input
          type="number"
          name="valorRepasse"
          step="0.01"
          min="0"
          required
          defaultValue={valorAtual ?? ''}
          placeholder="0,00"
          className="w-20 bg-transparent px-1.5 py-1.5 text-sm text-[var(--text)] outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[var(--cyan)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : valorAtual !== null ? 'Atualizar' : 'Salvar'}
      </button>
      {state.error && <span className="text-[11px] text-[var(--red)]">{state.error}</span>}
      {state.success && <span className="text-[11px] text-[var(--green)]">✓ salvo</span>}
    </form>
  )
}
