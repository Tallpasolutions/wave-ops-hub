import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 py-5">
      {/* Header */}
      <div className="mb-5">
        <Skeleton className="mb-1 h-6 w-28" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Card de gráfico */}
      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="h-40 w-full" />
      </div>

      {/* Cards de meses */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
            <div>
              <Skeleton className="mb-1 h-3 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="text-right">
              <Skeleton className="mb-1 h-3 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
