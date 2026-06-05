'use client'
import { useActionState, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { activateAccount } from './actions'

const initialState = { error: null as string | null }

export function FirstAccessForm() {
  const [state, formAction, isPending] = useActionState(activateAccount, initialState)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      setSessionError('Link de convite inválido ou expirado.')
      return
    }

    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setSessionError('Link de convite inválido ou expirado.')
      return
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setSessionError('Link expirado. Solicite um novo convite ao administrador.')
        } else {
          setSessionReady(true)
        }
      })
  }, [])

  function handleSubmit(formData: FormData) {
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string
    if (password !== confirm) {
      setConfirmError('As senhas não coincidem.')
      return
    }
    setConfirmError(null)
    formAction(formData)
  }

  if (sessionError) {
    return (
      <p className="text-sm text-red text-center">{sessionError}</p>
    )
  }

  if (!sessionReady) {
    return (
      <p className="text-sm text-text-3 text-center">Verificando convite…</p>
    )
  }

  return (
    <form action={handleSubmit} className="w-full flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3"
        >
          Criar senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="confirm"
          className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3"
        >
          Confirmar senha
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      {(confirmError ?? state.error) && (
        <p className="text-sm text-red text-center">{confirmError ?? state.error}</p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 w-full">
        {isPending ? 'Ativando…' : 'Ativar conta'}
      </Button>
    </form>
  )
}
