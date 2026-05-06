import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Next.js 15: cookies() é async — await obrigatório ou há erro de runtime críptico
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chamado de Server Component (read-only) — ignorar silenciosamente.
            // Server Actions conseguem escrever cookies normalmente.
          }
        },
      },
    }
  )
}
