'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { buildPeriodOptions } from '../_lib/period'

const PERIOD_PATHS = ['/dashboard', '/oss', '/financeiro', '/pagamentos', '/improdutivas', '/equipe/tecnicos']

function getMesAtual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function GlobalPeriodSelector() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const isRelevant = PERIOD_PATHS.some((p) => pathname.startsWith(p))
  if (!isRelevant) return <div className="flex-1" />

  const mesAtual = searchParams.get('mes') ?? getMesAtual()
  const options = buildPeriodOptions()

  function navigate(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', value)
    router.push(pathname + '?' + params.toString())
  }

  return (
    <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => navigate(opt.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            opt.value === mesAtual
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
