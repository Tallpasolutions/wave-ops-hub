'use client'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

// Botão de submit para <form action={serverAction}> que mostra estado de carregamento
// (useFormStatus) enquanto a Server Action roda — dá feedback de que o clique funcionou.
export function PendingSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode
  pendingLabel: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
