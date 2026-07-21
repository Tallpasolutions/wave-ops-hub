'use client'
import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { sincronizarIqi } from '../actions'

export function SyncIqiButton() {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  function onClick() {
    setMsg(null)
    startTransition(async () => {
      try {
        const r = await sincronizarIqi()
        setMsg({ ok: r.ok, texto: r.mensagem })
      } catch {
        // Se a própria Server Action falhar (ex.: timeout da função), mostra erro em
        // vez de deixar o botão girando indefinidamente.
        setMsg({ ok: false, texto: 'Falha ao sincronizar. Tente novamente em instantes.' })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/5 px-3.5 py-2 text-[13px] font-semibold text-[var(--text)] transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        <RefreshCw size={14} className={isPending ? 'animate-spin' : ''} />
        {isPending ? 'Sincronizando…' : 'Sincronizar IQI'}
      </button>
      {msg && (
        <span
          className={`text-[12px] ${msg.ok ? 'text-[var(--green)]' : 'text-[var(--amber)]'}`}
        >
          {msg.texto}
        </span>
      )}
    </div>
  )
}
