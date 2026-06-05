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
    <div className="p-7 pb-16">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-5">
        <div>
          <Skeleton className="mb-2 h-3 w-40" />
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* KPI Strip */}
      <section className="mb-7 grid grid-cols-3 gap-3.5 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-2 h-8 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="mt-3 h-3 w-20" />
          </div>
        ))}
      </section>

      {/* Volume chart */}
      <section className="mb-3.5">
        <SkeletonCard>
          <div className="mb-[18px] flex items-start justify-between">
            <div>
              <Skeleton className="mb-1.5 h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-56 w-full" />
        </SkeletonCard>
      </section>

      {/* Tipos OS + Donut */}
      <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
        <SkeletonCard>
          <div className="mb-[18px] flex items-start justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2 border-t border-[var(--line)]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12 ml-auto" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="flex items-center justify-center py-4">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </SkeletonCard>
      </section>

      {/* Ranking técnicos */}
      <section className="mb-3.5">
        <SkeletonCard>
          <div className="mb-[18px] flex items-start justify-between">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2.5 border-t border-[var(--line)]">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-12 ml-auto" />
                <Skeleton className="h-2 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </section>

      {/* Top valor + Não finalizadas */}
      <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-4 h-4 w-48" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex-1">
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </section>

      {/* Cidades + Motivos */}
      <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-4 h-4 w-40" />
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-1.5">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex-1">
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </section>

      {/* Qualidade + Resumo */}
      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <SkeletonCard>
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <div className="lg:col-span-2 rounded-2xl border p-[22px]" style={{ borderColor: 'rgba(0,212,255,0.18)' }}>
          <Skeleton className="mb-1 h-4 w-36" />
          <Skeleton className="mb-6 h-3 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>
    </div>
  )
}
