import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {/* Saudação */}
      <div className="mb-6">
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-1 h-4 w-24" />
      </div>

      {/* Card "A receber" */}
      <div
        className="mb-4 overflow-hidden rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, rgba(30,107,255,0.04) 100%)',
          border: '1px solid rgba(0,212,255,0.12)',
        }}
      >
        <Skeleton className="mb-2 h-3 w-32" />
        <Skeleton className="mb-2 h-10 w-40" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Grid 3 KPIs */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-center">
            <Skeleton className="mx-auto mb-1.5 h-7 w-12" />
            <Skeleton className="mx-auto h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-2 space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
