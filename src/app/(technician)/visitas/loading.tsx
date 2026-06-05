import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 py-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Skeleton className="mb-1 h-6 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Visit cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-l-2 border-[var(--line)] bg-[var(--bg-1)] p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <Skeleton className="mb-1 h-3 w-16" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
