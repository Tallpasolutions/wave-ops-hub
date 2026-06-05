'use server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requestPasswordReset(
  prevState: { sent: boolean; error: string | null },
  formData: FormData,
) {
  const email = formData.get('email') as string
  const supabase = await createSupabaseServerClient()

  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  const isLocal = ROOT === 'localhost'
  // Para MVP com tenant único, aponta para wave.*
  // Em multi-tenant completo, precisaria derivar o slug do tenant do usuário
  const redirectTo = isLocal
    ? `http://wave.localhost:3000/reset-password`
    : `https://wave.${ROOT}/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { sent: false, error: 'Não foi possível enviar o e-mail. Tente novamente.' }
  return { sent: true, error: null }
}
