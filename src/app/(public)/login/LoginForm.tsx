'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { AppRole } from '@/lib/auth/types'

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createSupabaseBrowserClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user || !data.session) {
      setError('E-mail ou senha inválidos.')
      setIsPending(false)
      return
    }

    let role: AppRole | undefined
    try {
      const payload = decodeJwtPayload(data.session.access_token)
      role = payload.app_role as AppRole | undefined
    } catch {
      setError('Sessão inválida. Tente novamente.')
      setIsPending(false)
      return
    }

    if (!role) {
      setError('Conta sem permissões configuradas. Contate o suporte.')
      setIsPending(false)
      return
    }

    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
    const isLocal = ROOT === 'localhost'
    const port = isLocal ? ':3000' : ''
    const scheme = isLocal ? 'http' : 'https'
    const hostname = window.location.hostname
    const subdomain = hostname.replace(`.${ROOT}`, '')

    // tallpa_owner logando de subdomain de tenant: exchange de sessão cross-subdomain via URL.
    // Browsers rejeitam domain=.localhost — callback seta os cookies no contexto de admin.
    if (role === 'tallpa_owner' && subdomain !== 'admin') {
      const params = new URLSearchParams({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        next: '/admin/dashboard',
      })
      window.location.href = `${scheme}://admin.${ROOT}${port}/auth/callback?${params}`
      return
    }

    if (role === 'tallpa_owner') {
      window.location.href = `${scheme}://admin.${ROOT}${port}/admin/dashboard`
    } else if (role === 'tenant_technician') {
      window.location.href = `${scheme}://${subdomain}.${ROOT}${port}/profile`
    } else {
      window.location.href = `${scheme}://${subdomain}.${ROOT}${port}/dashboard`
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 mt-2">
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

      <div className="flex flex-col gap-2">
        <label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-3"
        >
          Senha
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red text-center">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full"
      >
        {isPending ? 'Entrando…' : 'Entrar na plataforma'}
      </Button>

      <p className="text-center text-sm text-text-3">
        <Link href="/forgot-password" className="hover:text-text-2 transition-colors">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  )
}
