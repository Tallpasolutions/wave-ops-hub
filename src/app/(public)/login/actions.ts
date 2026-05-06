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
    role = payload.role as AppRole | undefined
  } catch {
    return { error: 'Sessão inválida. Tente novamente.' }
  }

  if (!role) {
    return { error: 'Conta sem permissões configuradas. Contate o suporte.' }
  }

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain') ?? 'wave'

  redirect(buildPostLoginUrl(role, subdomain))
}
