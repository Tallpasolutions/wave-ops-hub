import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Session exchange para cross-subdomain auth em localhost.
// Em produção, domain=.tallpa.com.br cobre todos os subdomínios nativamente.
//
// Fluxo: tallpa_owner loga em wave.localhost → login action redireciona para
// admin.localhost/auth/callback?access_token=...&refresh_token=...&next=...
// → este handler seta cookies diretamente no response de admin.localhost
// → /admin/dashboard recebe os cookies e encontra a sessão.
//
// IMPORTANTE: cookies().set() em Route Handlers não garante que os Set-Cookie
// apareçam no NextResponse retornado. O padrão correto é response.cookies.set().
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  const next = searchParams.get('next') ?? '/'

  const loginUrl = new URL('/login', request.url)

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(loginUrl)
  }

  const response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    return NextResponse.redirect(loginUrl)
  }

  return response
}
