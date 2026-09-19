import { supervisaoStatusLabel } from '@/lib/labels/supervisao'

export function StatusBadge({ status }: { status: string }) {
  const r = supervisaoStatusLabel(status)
  return (
    <span
      title={r.detalhado}
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${r.cls}`}
    >
      {r.curto}
    </span>
  )
}
