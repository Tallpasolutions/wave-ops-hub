import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-5">
      {/* Avatar + nome */}
      <div className="flex flex-col items-center gap-3 pb-2">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Card dados */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] divide-y divide-[var(--line)]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1">
              <Skeleton className="mb-1 h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Editar informações */}
      <div>
        <Skeleton className="mb-3 h-4 w-36" />
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <Skeleton className="mb-3 h-4 w-20" />
          <Skeleton className="h-9 w-full rounded-lg mb-4" />
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>

      {/* Alterar senha */}
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <Skeleton className="mb-3 h-9 w-full rounded-lg" />
          <Skeleton className="mb-3 h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
