import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Não consultamos o banco no middleware para manter a função leve.
// A existência real do tenant é verificada nos layouts dos portais via resolveTenantFromSlug().
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
const SLUG_REGEX = /^[a-z0-9-]{2,32}$/
const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'app', 'auth', 'static', 'public', 'assets', 'cdn', 'docs']

// Rotas que funcionam sem sessão — sessão inválida aqui não redireciona (evita loop no /login).
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/first-access', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]  // strip port

  // Root domain → redireciona para wave (tenant default em dev e prod)
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    const isLocalDev = ROOT_DOMAIN === 'localhost'
    const target = isLocalDev
      ? `http://wave.localhost:3000`
      : `https://wave.${ROOT_DOMAIN}`
    return NextResponse.redirect(new URL(target + request.nextUrl.pathname))
  }

  const subdomain = hostname.split('.')[0]

  // Slugs com formato inválido ou reservados (exceto admin, que é portal próprio) → 404
  if (subdomain !== 'admin' && (!SLUG_REGEX.test(subdomain) || RESERVED_SUBDOMAINS.includes(subdomain))) {
    return new NextResponse(null, { status: 404 })
  }

  // Injeta subdomain para uso nos layouts e Server Actions
  const headers = new Headers(request.headers)
  headers.set('x-subdomain', subdomain)

  // Refresh de sessão centralizado — ver src/lib/supabase/middleware.ts.
  // Sessão irrecuperável (refresh token queimado) → limpa cookies e manda para o login
  // com aviso, em vez de deixar a renderização falhar em tela preta.
  const { response, invalidSession } = await updateSession(request, headers)

  if (invalidSession && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = new URL('/login?expired=1', request.url)
    const redirect = NextResponse.redirect(loginUrl)
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brands/|icons/|manifest.webmanifest|sw.js|offline.html).*)',
  ],
}
