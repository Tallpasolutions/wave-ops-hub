'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageInfo } from '../_lib/pagination'

// Paginação server-side: cada clique troca ?page= preservando os demais filtros.
export function Pagination({ info }: { info: PageInfo }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (info.totalPages <= 1) {
    return (
      <p className="px-1 py-3 text-xs text-[var(--text-3)]">
        {info.totalItems} {info.totalItems === 1 ? 'item' : 'itens'}
      </p>
    )
  }

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div
      className={`flex items-center justify-between px-1 py-3 text-xs text-[var(--text-3)] transition-opacity ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      <span>
        {info.from}–{info.to} de {info.totalItems}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => goTo(info.page - 1)}
          disabled={info.page <= 1 || isPending}
          className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--text-2)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Anterior
        </button>
        <span className="px-1">
          {info.page} / {info.totalPages}
        </span>
        <button
          onClick={() => goTo(info.page + 1)}
          disabled={info.page >= info.totalPages || isPending}
          className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--text-2)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
