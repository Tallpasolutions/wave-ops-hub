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

  if (error || !data.user) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  // Ler role do app_metadata (injetado pelo Auth Hook custom_jwt_claims)
  // É mais confiável que getCurrentUser() em Server Action logo após login,
  // porque getCurrentUser() faz nova chamada de auth.getUser() que pode
  // não enxergar os cookies acabados de setar na mesma execução.
  const role = data.user.app_metadata?.role as AppRole | undefined

  if (!role) {
    return { error: 'Conta sem permissões configuradas. Contate o suporte.' }
  }

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain') ?? 'wave'

  redirect(buildPostLoginUrl(role, subdomain))
}
