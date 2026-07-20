'use client'
import { useActionState } from 'react'
import { resolverContestacao } from '../../actions'

export function ResolverContestacaoForm({ contestacaoId }: { contestacaoId: string }) {
  const action = resolverContestacao.bind(null, contestacaoId)
  const [state, formAction, pending] = useActionState(action, { error: null as string | null })

  return (
    <form action={formAction} className="mt-2.5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="resposta"
          required
          placeholder="Resposta ao técnico (ex.: valor ajustado / mantido porque…)"
          className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--cyan)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-[var(--cyan)] px-4 py-2 text-[13px] font-semibold text-[var(--bg)] disabled:opacity-50"
        >
          {pending ? 'Resolvendo…' : 'Resolver'}
        </button>
      </div>
      {state.error && <p className="mt-1 text-[12px] text-[var(--red)]">{state.error}</p>}
    </form>
  )
}
