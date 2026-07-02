'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ManagerError]', error)
  }, [error])

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-8">
      <AlertTriangle size={36} className="mb-4 text-[var(--red)]" />
      <h2 className="mb-2 font-display text-xl font-bold text-[var(--text)]">
        Algo deu errado
      </h2>
      <p className="mb-1 text-sm text-[var(--text-3)]">
        {error.message ?? 'Erro interno ao carregar esta página.'}
      </p>
      {error.digest && (
        <p className="mb-4 font-mono text-[10px] text-[var(--text-3)]">
          Código: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-4 py-2 text-sm font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)]"
      >
        Tentar novamente
      </button>
    </div>
  )
}
