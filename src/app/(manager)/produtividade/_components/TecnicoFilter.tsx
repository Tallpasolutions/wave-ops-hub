'use client'
import { useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

type Option = { id: string; nome: string }

// Filtro de técnico por querystring (ADR-010): seta/remove ?tecnico= preservando os
// demais params (mês). Todos os painéis da tela reagem ao subconjunto.
export function TecnicoFilter({ options, selected }: { options: Option[]; selected?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('tecnico', value)
    else params.delete('tecnico')
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  return (
    <div
      className={`relative inline-flex items-center transition-opacity ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      <select
        value={selected ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[var(--line)] bg-[var(--bg-1)] py-2 pl-3 pr-9 text-[13px] font-medium text-[var(--text)] outline-none transition-colors hover:border-[var(--line-strong)] focus:border-[var(--cyan)]"
      >
        <option value="">Todos os técnicos</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 text-[var(--text-3)]"
      />
    </div>
  )
}
