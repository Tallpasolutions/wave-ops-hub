'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { toggleFilter, type FilterKey } from './filters'

// Drill-down do dashboard (ADR-010): navega setando/removendo (toggle) um filtro na URL,
// preservando os demais params. `activeOf` diz o valor ativo de uma dimensão (para destacar).
export function useDrilldown() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const drill = (key: FilterKey, value: string) => {
    const qs = toggleFilter(new URLSearchParams(searchParams.toString()), key, value)
    router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  const activeOf = (key: FilterKey) => searchParams.get(key)

  return { drill, activeOf }
}
