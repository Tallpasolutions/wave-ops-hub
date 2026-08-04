'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

// Busca por nº de OS no app do técnico. Submete via ?os= (server-side). Quando há busca, a
// tela varre TODAS as visitas do técnico, não só as do mês — quem procura uma OS pelo número
// raramente lembra em que competência ela caiu.
export function OsSearchInput({ initial }: { initial: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(initial)

  function submit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) params.set('os', trimmed)
    else params.delete('os')
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className="relative"
    >
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
      />
      <input
        type="search"
        inputMode="numeric"
        enterKeyHint="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar OS pelo número"
        aria-label="Buscar OS pelo número"
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-1)] py-2.5 pl-9 pr-9 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--cyan)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('')
            submit('')
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-3)] active:bg-white/10"
          aria-label="Limpar busca"
          disabled={isPending}
        >
          <X size={15} />
        </button>
      )}
    </form>
  )
}
