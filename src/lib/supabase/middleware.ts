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

// Classificação do erro de sessão. A distinção entre CORRIDA e TERMINAL é o coração da
// correção do C1 (QA de 02/07/2026, "Invalid Refresh Token: Already Used").
//
// "already used" NÃO significa sessão morta. Significa que OUTRA requisição concorrente
// acabou de rotacionar o mesmo refresh token com sucesso — e portanto já existe um cookie
// novo e válido no navegador. Limpar os cookies nesse momento é exatamente o oposto do que
// se quer: destrói uma sessão que estava boa, e o gestor é expulso no meio do trabalho.
//
// "not found" e "session not found" são irrecuperáveis de verdade: aí limpar é o certo, para
// o navegador parar de reenviar um token queimado em loop.
export type TipoErroSessao = 'nenhum' | 'corrida' | 'terminal'

const CODIGOS_TERMINAIS = ['refresh_token_not_found', 'session_not_found']
const CODIGOS_DE_CORRIDA = ['refresh_token_already_used']

export function classificarErroSessao(
  error: { code?: string; message?: string } | null,
): TipoErroSessao {
  if (!error) return 'nenhum'

  if (error.code && CODIGOS_DE_CORRIDA.includes(error.code)) return 'corrida'
  if (error.code && CODIGOS_TERMINAIS.includes(error.code)) return 'terminal'

  const msg = error.message ?? ''
  // O erro real de produção chegou só como texto, sem código.
  if (/already used/i.test(msg)) return 'corrida'
  if (/invalid refresh token/i.test(msg)) return 'terminal'

  return 'nenhum'
}

// Mantida para quem só precisa saber "a sessão está ruim?" — os dois casos contam.
export function isInvalidSessionError(error: { code?: string; message?: string } | null): boolean {
  return classificarErroSessao(error) !== 'nenhum'
}

// Requisição de PREFETCH do Next.js. O router dispara várias em paralelo ao passar o mouse ou
// ao entrar na viewport, e cada uma executa este middleware — é daí que vem a concorrência que
// produz o "already used".
//
// Prefetch não deve mexer em estado de sessão: é uma busca especulativa que o usuário talvez
// nem use. Pular o refresh nelas ataca a CAUSA da corrida, não o sintoma.
export function isPrefetchRequest(headers: Headers): boolean {
  if (headers.get('next-router-prefetch') === '1') return true
  const purpose = headers.get('purpose') ?? headers.get('x-purpose') ?? ''
  return purpose.toLowerCase() === 'prefetch'
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

  // PREFETCH não renova sessão. Esta é a correção de CAUSA do C1: o router do Next dispara
  // várias requisições especulativas em paralelo (hover, viewport), todas passam por aqui, e
  // todas tentam rotacionar o MESMO refresh token. Uma vence, as outras recebem
  // "already used" — e antes isso derrubava a sessão inteira.
  //
  // Deixar o prefetch passar sem tocar na sessão é seguro: ele é especulativo, e a navegação
  // de verdade — que não é prefetch — renova normalmente logo em seguida.
  if (isPrefetchRequest(request.headers)) {
    return { response, hasUser: false, invalidSession: false }
  }

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

  const tipoErro = classificarErroSessao(error)

  // Corrida: outra requisição já renovou o token e o cookie bom está no navegador. Não limpa
  // e não trata como sessão inválida — no pior caso esta requisição específica passa sem
  // usuário, e a próxima navegação já funciona. Limpar aqui transformava uma corrida de
  // milissegundos em logout permanente (C1).
  const invalidSession = tipoErro === 'terminal'

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
