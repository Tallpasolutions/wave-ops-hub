'use client'
import { useActionState } from 'react'
import { updateTechnicianProfile } from '../actions'

interface Props {
  celular: string | null
  observacoes: string | null
}

export function EditProfileForm({ celular, observacoes }: Props) {
  const [state, action, pending] = useActionState(updateTechnicianProfile, { error: null, success: false })

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Celular
        </label>
        <input
          name="celular"
          type="tel"
          defaultValue={celular ?? ''}
          placeholder="(00) 90000-0000"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Observações
        </label>
        <textarea
          name="observacoes"
          defaultValue={observacoes ?? ''}
          placeholder="Informações adicionais..."
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>

      {state.error && (
        <p className="text-[12px] text-[var(--red)]">{state.error}</p>
      )}
      {state.success && (
        <p className="text-[12px] text-[var(--green)]">Dados salvos com sucesso.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-grad py-2.5 text-[13px] font-bold text-[#051127] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
