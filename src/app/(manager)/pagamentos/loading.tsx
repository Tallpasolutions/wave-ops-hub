import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <div className="bg-[var(--bg-1)] px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
