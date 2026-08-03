import type { Metadata } from 'next'
import Link from 'next/link'
import { DollarSign, TrendingUp, CalendarCheck, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Financeiro' }

const LINKS = [
  {
    href: '/pagamentos',
    icon: DollarSign,
    title: 'Pagamentos',
    description: 'Payouts por visita, pendências de regra e recálculo.',
  },
  {
    href: '/financeiro/visao-geral',
    icon: TrendingUp,
    title: 'Visão Geral',
    description: 'Receita da Unetvale, total a pagar e margem — com gráfico dos últimos meses.',
  },
  {
    href: '/fechamento',
    icon: CalendarCheck,
    title: 'Fechamento',
    description: 'Consolidação mensal para aprovação, pagamento e exportação.',
  },
  {
    href: '/alteracoes',
    icon: AlertTriangle,
    title: 'Alterações da Unetvale',
    description: 'OSs em que a Unetvale mudou o valor depois, por abertura de OS de garantia.',
  },
]

export default function FinanceiroPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-bold text-[var(--text)]">Financeiro</h1>
      <p className="mt-2 text-sm text-[var(--text-3)]">
        Pagamentos, visão de receita/margem e fechamento mensal.
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
