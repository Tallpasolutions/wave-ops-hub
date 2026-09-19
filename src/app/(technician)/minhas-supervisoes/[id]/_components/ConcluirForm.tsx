'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { PARECERES } from '@/lib/supervisao'
import { parecerLabel } from '@/lib/labels/supervisao'
import { concluirSupervisao } from '../../actions'

type Props = { supervisaoId: string; pendentes: number; semFoto: number }

export function ConcluirForm({ supervisaoId, pendentes, semFoto }: Props) {
  const [state, formAction, isPending] = useActionState(
    concluirSupervisao.bind(null, supervisaoId),
    { error: null as string | null, success: false },
  )

  const bloqueado = pendentes > 0 || semFoto > 0

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* O que falta aparece ANTES do botão, não como erro depois de tentar: rolar até o fim
          para descobrir que falta item é a pior forma de saber. */}
      {bloqueado && (
        <div className="rounded-lg border border-[rgba(255,181,71,0.25)] bg-[rgba(255,181,71,0.06)] px-4 py-3">
          <p className="text-sm text-[var(--amber)]">
            {pendentes > 0 && (
              <>
                Falta responder <strong>{pendentes}</strong>{' '}
                {pendentes === 1 ? 'item' : 'itens'}.
              </>
            )}
            {pendentes > 0 && semFoto > 0 && ' '}
            {semFoto > 0 && (
              <>
                Falta foto em <strong>{semFoto}</strong>{' '}
                {semFoto === 1 ? 'item' : 'itens'} que exigem.
              </>
            )}
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="parecerFinal"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
        >
          Parecer final
        </label>
        <select
          id="parecerFinal"
          name="parecerFinal"
          required
          disabled={bloqueado}
          className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)] disabled:opacity-50"
        >
          <option value="">Selecione</option>
          {PARECERES.map((p) => (
            <option key={p} value={p}>{parecerLabel(p).detalhado}</option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="notaQualidadeTecnica"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
        >
          Qualidade técnica (1 a 10)
        </label>
        <input
          id="notaQualidadeTecnica"
          name="notaQualidadeTecnica"
          type="number"
          min="1"
          max="10"
          disabled={bloqueado}
          placeholder="Opcional"
          className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)] disabled:opacity-50"
        />
        <p className="mt-1.5 text-xs text-[var(--text-3)]">
          Sua impressão geral. É separada da nota do checklist, que sai das respostas.
        </p>
      </div>

      <div>
        <label
          htmlFor="parecerObservacao"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
        >
          Relatório
        </label>
        <textarea
          id="parecerObservacao"
          name="parecerObservacao"
          rows={4}
          disabled={bloqueado}
          placeholder="O que aconteceu na visita, o que precisa de atenção."
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] disabled:opacity-50"
        />
      </div>

      {state.error && <p className="text-sm text-[var(--red)]">{state.error}</p>}

      <Button type="submit" disabled={isPending || bloqueado} className="min-h-[48px] w-full">
        {isPending ? 'Finalizando…' : 'Finalizar vistoria'}
      </Button>
    </form>
  )
}
