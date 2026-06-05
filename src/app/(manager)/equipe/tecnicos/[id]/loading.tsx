import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Skeleton className="mb-4 h-4 w-20" />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>

      {/* Dados cadastrais */}
      <div className="mb-8 grid grid-cols-2 gap-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* 4 KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Tabela de visitas */}
      <div>
        <Skeleton className="mb-3 h-3 w-32" />
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="bg-[var(--bg-1)] px-4 py-3">
            <Skeleton className="h-3 w-full" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
