'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const headerStore = await headers()
  const subdomain = headerStore.get('x-subdomain') ?? 'wave'

  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  const isLocal = ROOT === 'localhost'
  const scheme = isLocal ? 'http' : 'https'
  const port = isLocal ? ':3000' : ''

  redirect(`${scheme}://${subdomain}.${ROOT}${port}/login`)
}
