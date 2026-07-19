import { Skeleton } from '@/components/ui/skeleton'

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[rgba(10,15,34,0.4)] p-[22px]">
      {children}
    </div>
  )
}

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-40" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* 4 KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-5 py-4">
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>

      {/* Gráfico 6 meses */}
      <SkeletonCard>
        <div className="mb-[18px] flex items-start justify-between">
          <div>
            <Skeleton className="mb-1.5 h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </SkeletonCard>

      {/* 2 tabelas */}
      {[0, 1].map((t) => (
        <div key={t} className="mt-6 overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="bg-[var(--bg-1)] px-4 py-3">
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
