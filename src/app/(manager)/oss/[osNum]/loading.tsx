import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <Skeleton className="mb-6 h-4 w-24" />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Timeline de visitas */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <Skeleton className="mb-1.5 h-3 w-20" />
                <Skeleton className="h-5 w-36" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Skeleton className="mb-1 h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div>
                <Skeleton className="mb-1 h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div>
                <Skeleton className="mb-1 h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
