import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  cta?: { label: string; href: string }
  variant?: 'page' | 'card'
}

export function EmptyState({ icon: Icon, title, description, cta, variant = 'page' }: Props) {
  const inner = (
    <>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--bg-1)]">
        <Icon size={24} className="text-[var(--text-3)]" />
      </div>
      <p className="font-display text-[15px] font-semibold text-[var(--text)]">{title}</p>
      {description && (
        <p className="mt-2 max-w-xs text-[13px] text-[var(--text-3)]">{description}</p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-5 rounded-lg bg-[var(--cyan)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
        >
          {cta.label}
        </Link>
      )}
    </>
  )

  if (variant === 'card') {
    return (
      <div className="flex flex-col items-center rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-6 py-12 text-center">
        {inner}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {inner}
    </div>
  )
}
