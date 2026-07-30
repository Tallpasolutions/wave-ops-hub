'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { overridePayout } from '../../../actions'

type Props = {
  payoutId: string
  valorAtual: number | null
}

export function OverridePayoutForm({ payoutId, valorAtual }: Props) {
  const [state, formAction, pending] = useActionState(
    overridePayout.bind(null, payoutId),
    { error: null },
  )

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="valorOverride">Novo valor (R$)</Label>
        <Input
          id="valorOverride"
          name="valorOverride"
          type="number"
          step="0.01"
          min="0"
          placeholder={valorAtual !== null ? String(valorAtual) : '0.00'}
          className="mt-1"
          required
        />
        {valorAtual !== null && (
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Valor calculado atual:{' '}
            {valorAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="overrideMotivo">Motivo do ajuste</Label>
        <textarea
          id="overrideMotivo"
          name="overrideMotivo"
          rows={4}
          required
          minLength={10}
          placeholder="Descreva o motivo da alteração manual do valor..."
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Salvando...' : 'Confirmar override'}
      </Button>
    </form>
  )
}
