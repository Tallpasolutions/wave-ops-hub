'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { buildPostLoginUrl } from '@/lib/auth/redirect'

export async function activateAccount(
  prevState: { error: string | null },
  formData: FormData,
) {
  const password = formData.get('password') as string
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Não foi possível ativar a conta. Tente novamente.' }

  const user = await getCurrentUser()
  if (!user) return { error: 'Não foi possível carregar dados do usuário.' }

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain') ?? 'wave'

  redirect(buildPostLoginUrl(user.role, subdomain))
}
