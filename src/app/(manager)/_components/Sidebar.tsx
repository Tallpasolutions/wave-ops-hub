'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { isValidMes } from '../_lib/period'
import {
  LayoutDashboard,
  Users,
  HardHat,
  FileUp,
  ClipboardList,
  DollarSign,
  CalendarCheck,
  Tag,
  ScrollText,
  TrendingUp,
  HelpCircle,
  LogOut,
  CheckCircle2,
} from 'lucide-react'
import { TenantLogo } from '@/components/ui/TenantLogo'
import { signOut } from '@/lib/auth/logout'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  disabled?: boolean
}

// Telas cujo link deve carregar o período atual na URL, para o mês escolhido se manter
// ao navegar (URLs distintas por mês evitam o staleness do Router Cache do Next).
// /improdutivas fica de fora de propósito: é fila de aprovação, default "todos os períodos".
const PERIOD_NAV = new Set(['/dashboard', '/oss', '/financeiro', '/pagamentos'])

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/equipe', label: 'Equipe', icon: Users },
  { href: '/equipe/tecnicos', label: 'Técnicos', icon: HardHat },
  { href: '/uploads', label: 'Uploads', icon: FileUp },
  { href: '/motivos', label: 'Improdutivas', icon: Tag },
  { href: '/improdutivas', label: 'Aprovação', icon: CheckCircle2 },
  { href: '/lpu', label: 'LPU', icon: ScrollText },
  { href: '/oss', label: 'OSs', icon: ClipboardList },
  { href: '/pagamentos', label: 'Pagamentos', icon: DollarSign },
  { href: '/financeiro', label: 'Financeiro', icon: TrendingUp },
  { href: '/fechamento', label: 'Fechamento', icon: CalendarCheck },
  { href: '/ajuda', label: 'Ajuda', icon: HelpCircle },
]

interface ManagerSidebarProps {
  nomeCompleto: string
  email: string
  tenantNome: string
  improdutivasPendentes?: number
  onClose?: () => void
}

export function ManagerSidebar({
  nomeCompleto,
  email,
  tenantNome,
  improdutivasPendentes,
  onClose,
}: ManagerSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Propaga o período atual (só o ?mes= da URL, para não quebrar a hidratação — o cookie
  // é lido no servidor). Sem ?mes=, o link fica limpo e o servidor cai no default
  // (último mês com dados / cookie).
  const spMes = searchParams.get('mes')
  const currentMes = isValidMes(spMes) ? spMes : undefined

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-1)]">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-5">
        <TenantLogo variant="mark" />
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--text)]">
            {tenantNome}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
            Manager
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, disabled }) => {
          if (disabled) {
            return (
              <span
                key={href}
                className="mb-1 flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-40"
              >
                <Icon size={16} />
                {label}
                <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/10 text-[var(--text-3)]">
                  Em breve
                </span>
              </span>
            )
          }

          const active =
            href === '/equipe'
              ? pathname === '/equipe'
              : pathname === href || pathname.startsWith(href + '/')

          const linkHref =
            PERIOD_NAV.has(href) && isValidMes(currentMes) ? `${href}?mes=${currentMes}` : href

          return (
            <Link
              key={href}
              href={linkHref}
              onClick={onClose}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-l-2 border-[var(--cyan)] bg-[var(--grad-soft)] pl-[10px] text-[var(--cyan)]'
                  : 'text-[var(--text-2)] hover:bg-white/5 hover:text-[var(--text)]'
              }`}
            >
              <Icon size={16} />
              {label}
              {href === '/improdutivas' && !!improdutivasPendentes && improdutivasPendentes > 0 && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[9px] font-bold text-white">
                  {improdutivasPendentes}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--line)] px-4 py-4">
        <p className="truncate text-sm font-medium text-[var(--text)]">{nomeCompleto}</p>
        <p className="mb-3 truncate text-xs text-[var(--text-3)]">{email}</p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
          >
            <LogOut size={14} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
