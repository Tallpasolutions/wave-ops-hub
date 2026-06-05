import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Em produção, compartilha cookies entre subdomínios via domain=.tallpa.com.br.
// Em localhost, browsers rejeitam domain=.localhost — usamos session exchange via URL
// no fluxo de login cross-subdomain (tallpa_owner logando de subdomain diferente de admin).
function getSharedCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  if (root === 'localhost') return undefined
  return `.${root}`
}

// Next.js 15: cookies() é async — await obrigatório ou há erro de runtime críptico
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const cookieDomain = getSharedCookieDomain()

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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
            })
          } catch {
            // Server Component: cookies são read-only — ignorar silenciosamente.
          }
        },
      },
    }
  )
}
