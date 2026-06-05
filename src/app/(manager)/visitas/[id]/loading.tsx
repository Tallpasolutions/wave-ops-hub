import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-4 w-28" />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Grid de info */}
      <div className="mb-6 grid grid-cols-2 gap-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-1.5 h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      {/* Payout block */}
      <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Audit trail */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
        <Skeleton className="mb-4 h-4 w-36" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 border-t border-[var(--line)] pt-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
