import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Não consultamos o banco no middleware para manter a função síncrona e leve.
// A existência real do tenant é verificada nos layouts dos portais via resolveTenantFromSlug().
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost'
const SLUG_REGEX = /^[a-z0-9-]{2,32}$/
const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'app', 'auth', 'static', 'public', 'assets', 'cdn', 'docs']

export function middleware(request: NextRequest) {
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

  // Admin portal — auth enforcement via requireRole em (admin)/layout.tsx
  if (subdomain === 'admin') {
    const headers = new Headers(request.headers)
    headers.set('x-subdomain', 'admin')
    return NextResponse.next({ request: { headers } })
  }

  // Slugs com formato inválido ou reservados retornam 404 imediato
  if (!SLUG_REGEX.test(subdomain) || RESERVED_SUBDOMAINS.includes(subdomain)) {
    return new NextResponse(null, { status: 404 })
  }

  // Formato válido — injeta subdomain para uso nos layouts e Server Actions
  const headers = new Headers(request.headers)
  headers.set('x-subdomain', subdomain)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brands/).*)'],
}
