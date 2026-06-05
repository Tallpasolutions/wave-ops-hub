'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { requestPasswordReset } from './actions'

const initialState = { sent: false, error: null as string | null }

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState)

  if (state.sent) {
    return (
      <div className="w-full text-center flex flex-col gap-4">
        <p className="text-sm text-text-2">
          Enviamos um link de recuperação para o seu e-mail. Verifique sua caixa de entrada.
        </p>
        <Link href="/login" className="text-sm text-cyan hover:opacity-80 transition-opacity">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="w-full flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3"
        >
          E-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-red text-center">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 w-full">
        {isPending ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>

      <p className="text-center text-sm text-text-3">
        <Link href="/login" className="hover:text-text-2 transition-colors">
          Voltar para o login
        </Link>
      </p>
    </form>
  )
}
