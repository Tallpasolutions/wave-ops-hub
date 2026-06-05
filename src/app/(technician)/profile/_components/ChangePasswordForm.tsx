'use client'
import { useActionState } from 'react'
import { changePassword } from '../actions'

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, { error: null, success: false })

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Nova senha
        </label>
        <input
          name="newPassword"
          type="password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Confirmar senha
        </label>
        <input
          name="confirmPassword"
          type="password"
          placeholder="Repita a nova senha"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>

      {state.error && <p className="text-[12px] text-[var(--red)]">{state.error}</p>}
      {state.success && (
        <p className="text-[12px] text-[var(--green)]">Senha alterada com sucesso.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-[var(--line)] py-2.5 text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--line-strong)] hover:bg-white/5 disabled:opacity-50"
      >
        {pending ? 'Alterando...' : 'Alterar senha'}
      </button>
    </form>
  )
}
