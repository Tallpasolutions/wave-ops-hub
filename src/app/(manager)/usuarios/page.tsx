import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, HardHat } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Usuários' }

const LINKS = [
  {
    href: '/equipe',
    icon: Users,
    title: 'Equipe',
    description: 'Gestores e supervisores da operação, com último acesso e permissões.',
  },
  {
    href: '/equipe/tecnicos',
    icon: HardHat,
    title: 'Técnicos',
    description: 'Cadastro de técnicos, vínculos com a planilha e acesso ao portal.',
  },
]

export default function UsuariosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-bold text-[var(--text)]">Usuários</h1>
      <p className="mt-2 text-sm text-[var(--text-3)]">
        Equipe interna e técnicos da operação.
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
