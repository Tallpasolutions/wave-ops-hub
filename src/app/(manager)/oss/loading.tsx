import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* KPI mini */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Chips de filtro */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="bg-[var(--bg-1)] px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-5 w-20 rounded-full ml-auto" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
