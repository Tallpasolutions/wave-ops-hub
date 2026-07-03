import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// O refresh de token acontece EXCLUSIVAMENTE aqui. Server Components não conseguem
// gravar cookies (setAll é engolido em server.ts), então um refresh disparado lá
// perde o token rotacionado e invalida a sessão inteira na request seguinte
// ("Invalid Refresh Token: Already Used" — ver docs/qa/2026-07-02-relatorio-qa-producao.md, C1).
// Referência: https://supabase.com/docs/guides/auth/server-side/nextjs

function getSharedCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
  if (root === 'localhost') return undefined
  return `.${root}`
}

// Códigos do GoTrue que significam sessão irrecuperável — exigem limpar cookies
// para não deixar o browser em loop reenviando um refresh token queimado.
const INVALID_SESSION_CODES = [
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
]

export function isInvalidSessionError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code && INVALID_SESSION_CODES.includes(error.code)) return true
  return /invalid refresh token/i.test(error.message ?? '')
}

export type UpdateSessionResult = {
  response: NextResponse
  hasUser: boolean
  invalidSession: boolean
}

export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const cookieDomain = getSharedCookieDomain()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              cookieDomain ? { ...options, domain: cookieDomain } : options,
            ),
          )
        },
      },
    },
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const invalidSession = isInvalidSessionError(error)

  if (invalidSession) {
    for (const cookie of request.cookies.getAll()) {
      if (!cookie.name.startsWith('sb-')) continue
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
      if (cookieDomain) {
        response.cookies.set(cookie.name, '', { maxAge: 0, path: '/', domain: cookieDomain })
      }
    }
  }

  return { response, hasUser: Boolean(user), invalidSession }
}
