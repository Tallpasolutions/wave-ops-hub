'use server'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function updatePassword(
  prevState: { error: string | null },
  formData: FormData,
) {
  const password = formData.get('password') as string
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }
  redirect('/login')
}
