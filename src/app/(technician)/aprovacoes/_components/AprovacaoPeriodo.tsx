'use client'
import { useActionState, useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageSquareWarning } from 'lucide-react'
import { contestarPayout, aprovarRevisao } from '../actions'

export type PayoutItem = {
  id: string
  osNum: number
  data: string
  finalidade: string | null
  valor: number
  acrescimoDomFeriado: number | null
  contestacao: {
    status: 'aberta' | 'resolvida'
    motivo: string
    resposta: string | null
    valorAnterior: number | null
    valorNovo: number | null
  } | null
}

// App do técnico exibe valores em pontos (pts), não em R$ — mesma convenção da home e de /visitas.
const fmtPts = (n: number) => `${Math.round(n).toLocaleString('pt-BR')} pts`
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

export function AprovacaoPeriodo({
  periodo,
  periodoLabel,
  items,
}: {
  periodo: string
  periodoLabel: string
  items: PayoutItem[]
}) {
  const total = items.reduce((s, i) => s + i.valor, 0)
  const temContestacaoAberta = items.some((i) => i.contestacao?.status === 'aberta')

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-3)]">
          Conferência de fechamento
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold capitalize text-[var(--text)]">
          {periodoLabel}
        </h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
          Confira suas {items.length} OSs. Aprove se estiver tudo certo, ou conteste as que
          julgar erradas.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
          Total do período
        </p>
        <p className="mt-1 font-display text-2xl font-bold text-[var(--text)]">{fmtPts(total)}</p>
      </div>

      <div className="mb-4 space-y-2.5">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} periodo={periodo} />
        ))}
      </div>

      <AprovarButton periodo={periodo} disabled={temContestacaoAberta} />
      {temContestacaoAberta && (
        <p className="mt-2 text-center text-[11px] text-[var(--amber)]">
          Você tem contestações em aberto. Aguarde a resposta da Wave para aprovar.
        </p>
      )}
    </div>
  )
}

function ItemCard({ item, periodo }: { item: PayoutItem; periodo: string }) {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, pending] = useActionState(contestarPayout, {
    error: null as string | null,
  })

  const c = item.contestacao

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] font-bold text-[var(--text)]">OS {item.osNum}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
            {item.finalidade ?? 'Sem finalidade'} · {fmtData(item.data)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[14px] font-bold text-[var(--text)]">{fmtPts(item.valor)}</p>
          {item.acrescimoDomFeriado != null && item.acrescimoDomFeriado > 0 && (
            <p className="mt-0.5 font-mono text-[10px] text-[var(--cyan)]">
              inclui +{fmtPts(item.acrescimoDomFeriado)} domingo/feriado
            </p>
          )}
        </div>
      </div>

      {c ? (
        <div
          className="mt-3 rounded-lg border p-3 text-[12px]"
          style={
            c.status === 'aberta'
              ? { background: 'rgba(255,181,71,0.06)', borderColor: 'rgba(255,181,71,0.2)' }
              : { background: 'rgba(46,230,168,0.06)', borderColor: 'rgba(46,230,168,0.2)' }
          }
        >
          <p
            className="flex items-center gap-1.5 font-semibold"
            style={{ color: c.status === 'aberta' ? 'var(--amber)' : 'var(--green)' }}
          >
            {c.status === 'aberta' ? (
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
            <span className="text-[var(--text-3)]">Seu motivo:</span> {c.motivo}
          </p>
          {c.resposta && (
            <p className="mt-1 text-[var(--text-2)]">
              <span className="text-[var(--text-3)]">Resposta:</span> {c.resposta}
            </p>
          )}
          {c.status === 'resolvida' &&
            c.valorAnterior != null &&
            c.valorNovo != null &&
            Math.round(c.valorAnterior) !== Math.round(c.valorNovo) && (
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[var(--text)]">
                <span className="text-[var(--text-3)] line-through">
                  {fmtPts(c.valorAnterior)}
                </span>
                →
                <span className="text-[var(--green)]">{fmtPts(c.valorNovo)}</span>
              </p>
            )}
        </div>
      ) : aberto ? (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="payoutId" value={item.id} />
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
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--amber)]"
        >
          <AlertTriangle size={13} /> Contestar esta OS
        </button>
      )}
    </div>
  )
}

function AprovarButton({ periodo, disabled }: { periodo: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(aprovarRevisao, {
    error: null as string | null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="periodo" value={periodo} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] py-3 text-[14px] font-bold text-[#00291c] disabled:opacity-40"
      >
        <CheckCircle2 size={16} />
        {pending ? 'Aprovando…' : 'Aprovar todas as OSs'}
      </button>
      {state.error && <p className="mt-2 text-center text-[12px] text-[var(--red)]">{state.error}</p>}
    </form>
  )
}
