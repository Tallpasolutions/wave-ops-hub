'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { PeriodMes } from '../_lib/period'

interface Props {
  options: PeriodMes[]
  selected: string
}

export function PeriodSelector({ options, selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-1.5 pr-7 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2 text-[var(--text-3)]"
      />
    </div>
  )
}
