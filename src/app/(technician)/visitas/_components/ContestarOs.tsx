'use client'
import { useActionState, useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageSquareWarning } from 'lucide-react'
import { contestarPayout } from '../../aprovacoes/actions'

export type Contestacao = {
  status: 'aberta' | 'resolvida'
  motivo: string
  resposta: string | null
  valorAnterior: number | null
  valorNovo: number | null
}

const fmtPts = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} pts`

// Contestação contínua (ADR-013 estendido): o técnico pode contestar uma OS a qualquer
// momento, direto da lista de visitas — não só na janela de fechamento. Reaproveita a
// action `contestarPayout` (registra a contestação, marca o payout e notifica a Wave).
export function ContestarOs({
  payoutId,
  periodo,
  contestacao,
}: {
  payoutId: string
  periodo: string
  contestacao: Contestacao | null
}) {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, pending] = useActionState(contestarPayout, {
    error: null as string | null,
  })

  if (contestacao) {
    const aberta = contestacao.status === 'aberta'
    return (
      <div
        className="mt-3 rounded-lg border p-3 text-[12px]"
        style={
          aberta
            ? { background: 'rgba(255,181,71,0.06)', borderColor: 'rgba(255,181,71,0.2)' }
            : { background: 'rgba(46,230,168,0.06)', borderColor: 'rgba(46,230,168,0.2)' }
        }
      >
        <p
          className="flex items-center gap-1.5 font-semibold"
          style={{ color: aberta ? 'var(--amber)' : 'var(--green)' }}
        >
          {aberta ? (
            <>
              <MessageSquareWarning size={13} /> Contestada · aguardando Wave
            </>
          ) : (
            <>
              <CheckCircle2 size={13} /> Contestação respondida
            </>
          )}
        </p>
        <p className="mt-1 text-[var(--text-2)]">
          <span className="text-[var(--text-3)]">Seu motivo:</span> {contestacao.motivo}
        </p>
        {contestacao.resposta && (
          <p className="mt-1 text-[var(--text-2)]">
            <span className="text-[var(--text-3)]">Resposta:</span> {contestacao.resposta}
          </p>
        )}
        {contestacao.status === 'resolvida' &&
          contestacao.valorAnterior != null &&
          contestacao.valorNovo != null &&
          Math.round(contestacao.valorAnterior) !== Math.round(contestacao.valorNovo) && (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[var(--text)]">
              <span className="text-[var(--text-3)] line-through">
                {fmtPts(contestacao.valorAnterior)}
              </span>
              →<span className="text-[var(--green)]">{fmtPts(contestacao.valorNovo)}</span>
            </p>
          )}
      </div>
    )
  }

  if (aberto) {
    return (
      <form action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="payoutId" value={payoutId} />
        <input type="hidden" name="periodo" value={periodo} />
        <textarea
          name="motivo"
          rows={3}
          required
          placeholder="Explique o que está errado nesta OS…"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2.5 text-[13px] text-[var(--text)] outline-none focus:border-[var(--cyan)]"
        />
        {state.error && <p className="text-[12px] text-[var(--red)]">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-[var(--amber)] py-2 text-[13px] font-semibold text-[#1a1200] disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar contestação'}
          </button>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--text-2)]"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAberto(true)}
      className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--amber)]"
    >
      <AlertTriangle size={13} /> Contestar esta OS
    </button>
  )
}
