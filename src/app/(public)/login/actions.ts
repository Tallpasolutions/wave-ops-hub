'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildPostLoginUrl } from '@/lib/auth/redirect'
import type { AppRole } from '@/lib/auth/types'

export async function signIn(_prevState: { error: string | null }, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user || !data.session) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  // O Auth Hook (custom_jwt_claims) injeta 'role' no payload do JWT, não em
  // app_metadata. Decodificamos o access_token para ler os custom claims sem
  // fazer round-trip adicional — o token veio direto do Supabase nesta resposta.
  let role: AppRole | undefined
  try {
    const payload = JSON.parse(
      Buffer.from(data.session.access_token.split('.')[1], 'base64url').toString()
    )
    role = payload.app_role as AppRole | undefined
  } catch {
    return { error: 'Sessão inválida. Tente novamente.' }
  }

  if (!role) {
    return { error: 'Conta sem permissões configuradas. Contate o suporte.' }
  }

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain') ?? 'wave'

  // tallpa_owner logando de um subdomain de tenant precisa cruzar para admin.localhost.
  // Browsers rejeitam domain=.localhost, então usamos session exchange via URL:
  // o callback seta a sessão no contexto correto de admin.localhost.
  if (role === 'tallpa_owner' && subdomain !== 'admin') {
    const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
    const isLocal = ROOT === 'localhost'
    const port = isLocal ? ':3000' : ''
    const scheme = isLocal ? 'http' : 'https'
    const params = new URLSearchParams({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      next: '/admin/dashboard',
    })
    redirect(`${scheme}://admin.${ROOT}${port}/auth/callback?${params}`)
  }

  redirect(buildPostLoginUrl(role, subdomain))
}
