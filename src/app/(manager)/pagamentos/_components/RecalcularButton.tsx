'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recalcularPendentesChunk } from '../actions'

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; processed: number; skipped: number }
  | { kind: 'error'; message: string }

export function RecalcularButton() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const running = status.kind === 'running'

  async function run() {
    setStatus({ kind: 'running', done: 0, total: 0 })
    let offset = 0
    let processed = 0
    let skipped = 0

    for (;;) {
      const res = await recalcularPendentesChunk(offset)
      if (!res.ok) {
        setStatus({ kind: 'error', message: res.error })
        return
      }
      processed += res.processed
      skipped += res.skipped
      offset = res.nextOffset
      setStatus({ kind: 'running', done: offset, total: res.total })
      if (!res.hasMore) break
    }

    setStatus({ kind: 'done', processed, skipped })
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {status.kind === 'running' && (
        <span className="text-xs text-[var(--text-3)]">
          Recalculando… {status.done}{status.total > 0 ? `/${status.total}` : ''} visitas
        </span>
      )}
      {status.kind === 'done' && (
        <span className="text-xs text-[var(--green)]">
          {status.processed} recalculadas · {status.skipped} preservadas (aprovadas/pagas)
        </span>
      )}
      {status.kind === 'error' && (
        <span className="text-xs text-[var(--red)]">{status.message}</span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={running}
        title="Recalcula todos os pagamentos pendentes com as regras LPU atuais"
        className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? 'Recalculando…' : 'Recalcular pendentes'}
      </button>
    </div>
  )
}
