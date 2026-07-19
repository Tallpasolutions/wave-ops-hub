import type { Metadata } from 'next'
import Link from 'next/link'
import { Tag, CheckCircle2, ScrollText, Cable } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Regras' }

const LINKS = [
  {
    href: '/motivos',
    icon: Tag,
    title: 'Improdutivas',
    description: 'Classifique os motivos de improdutiva (categoria e política de pagamento).',
  },
  {
    href: '/improdutivas',
    icon: CheckCircle2,
    title: 'Aprovação',
    description: 'Fila para aprovar ou rejeitar as improdutivas pendentes.',
  },
  {
    href: '/lpu',
    icon: ScrollText,
    title: 'LPU',
    description: 'Lista de Preços Unitários: regras de quanto pagar ao técnico por serviço.',
  },
  {
    href: '/cabeamento',
    icon: Cable,
    title: 'Cabeamento',
    description: 'Classificação de cabeamento / segundo ponto por valor da explicação.',
  },
]

export default function RegrasPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-bold text-[var(--text)]">Regras</h1>
      <p className="mt-2 text-sm text-[var(--text-3)]">
        Regras e aprovações que definem como o pagamento é calculado.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition-colors hover:border-[var(--cyan)]/40 hover:bg-[var(--grad-soft)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cyan)]/10 text-[var(--cyan)]">
              <Icon size={20} />
            </div>
            <div>
              <p className="font-medium text-[var(--text)]">{title}</p>
              <p className="mt-0.5 text-sm text-[var(--text-3)]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
