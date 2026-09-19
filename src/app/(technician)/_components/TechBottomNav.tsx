'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Gauge,
  BarChart3,
  UserCircle2,
  Users,
  ClipboardCheck,
} from 'lucide-react'

const BASE_NAV = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/visitas', label: 'Visitas', icon: ClipboardList },
  { href: '/iqi', label: 'IQI', icon: Gauge },
  { href: '/historico', label: 'Histórico', icon: BarChart3 },
  { href: '/profile', label: 'Perfil', icon: UserCircle2 },
]

const SUPERVISOR_ITEM = { href: '/minha-equipe', label: 'Equipe', icon: Users }

// Supervisão de campo (ADR-022): só aparece para supervisor E com a feature flag do tenant
// ligada. O técnico comum nunca vê — ele não tem acesso às supervisões nem à própria.
//
// O rótulo é "Campo", não "Supervisão", por medição a 360px: a célula é flex-1, e o texto
// "Supervisão" (73px) rouba espaço das outras, derrubando-as de 58px para 30px e fazendo os
// rótulos encostarem. Com "Campo" a menor célula fica em 48px e a barra continua legível.
// Nenhum rótulo existente foi encurtado — com a flag desligada a barra é idêntica à de hoje.
const SUPERVISAO_ITEM = { href: '/minhas-supervisoes', label: 'Campo', icon: ClipboardCheck }

export function TechBottomNav({
  isSupervisor = false,
  showSupervisoes = false,
}: {
  isSupervisor?: boolean
  showSupervisoes?: boolean
}) {
  const pathname = usePathname()
  // Sem as props, a barra é exatamente BASE_NAV — a navegação do técnico não muda em nada.
  const nav = isSupervisor
    ? [...BASE_NAV, SUPERVISOR_ITEM, ...(showSupervisoes ? [SUPERVISAO_ITEM] : [])]
    : BASE_NAV

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-[var(--line)] bg-[var(--bg-1)]">
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
              active ? 'text-[var(--cyan)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
