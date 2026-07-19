'use client'

import { useTransition } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { buildPeriodOptions, PERIODO_COOKIE } from '../_lib/period'

// Só as telas de lista onde o período faz sentido. Match EXATO — antes usava
// startsWith('/oss'), que fazia o chip aparecer inerte nos detalhes (/oss/569020).
const PERIOD_PATHS = ['/dashboard', '/oss', '/financeiro/visao-geral', '/pagamentos', '/improdutivas']

type Props = {
  // Períodos reais do tenant (desc) e o período efetivo resolvido no server.
  availablePeriods: string[]
  effectiveMes: string
}

export function GlobalPeriodSelector({ availablePeriods, effectiveMes }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!PERIOD_PATHS.includes(pathname)) return <div className="flex-1" />

  const selecionado = searchParams.get('mes') ?? effectiveMes
  const options = buildPeriodOptions(availablePeriods.length > 0 ? availablePeriods : undefined)

  function navigate(value: string) {
    // Cookie persiste a escolha entre rotas (a sidebar não carrega ?mes=).
    document.cookie = `${PERIODO_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', value)
    startTransition(() => router.push(pathname + '?' + params.toString()))
  }

  return (
    <div
      className={`flex flex-1 items-center gap-1.5 overflow-x-auto transition-opacity ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => navigate(opt.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            opt.value === selecionado
              ? 'bg-[var(--cyan)] text-[var(--bg)]'
              : 'bg-white/5 text-[var(--text-2)] hover:bg-white/10'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
