'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

// Busca por nº de OS. Submete via ?q= (server-side), reseta a página e preserva os
// demais filtros. Limpar remove o q e o page.
export function OsSearchInput() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  function submit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) params.set('q', trimmed)
    else params.delete('q')
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className="flex items-center gap-2"
    >
      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
        />
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar por nº de OS"
          className="w-48 rounded-lg border border-[var(--line)] bg-[var(--bg)] py-1.5 pl-8 pr-7 text-xs text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              submit('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)]"
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[var(--cyan)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Buscar
      </button>
    </form>
  )
}
