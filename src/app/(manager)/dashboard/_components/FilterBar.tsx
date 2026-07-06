'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import {
  FILTER_LABEL,
  removeFilter,
  clearFilters,
  type FilterKey,
} from '../_lib/filters'

type Props = {
  active: { key: FilterKey; label: string }[]
}

export function FilterBar({ active }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  if (active.length === 0) return null

  const go = (qs: string) => router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  const params = () => new URLSearchParams(searchParams.toString())

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        Filtros
      </span>
      {active.map((f) => (
        <button
          key={f.key}
          onClick={() => go(removeFilter(params(), f.key))}
          title={`Remover filtro de ${FILTER_LABEL[f.key]}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(0,212,255,0.12)] py-1 pl-2.5 pr-2 text-xs font-medium text-[var(--cyan)] transition-colors hover:bg-[rgba(0,212,255,0.2)]"
        >
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            {FILTER_LABEL[f.key]}:
          </span>
          {f.label}
          <X size={12} />
        </button>
      ))}
      {active.length > 1 && (
        <button
          onClick={() => go(clearFilters(params()))}
          className="text-xs text-[var(--text-3)] underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline"
        >
          limpar tudo
        </button>
      )}
    </div>
  )
}
