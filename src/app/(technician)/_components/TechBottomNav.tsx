'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, BarChart3, UserCircle2 } from 'lucide-react'

const NAV = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/visitas', label: 'Visitas', icon: ClipboardList },
  { href: '/historico', label: 'Histórico', icon: BarChart3 },
  { href: '/profile', label: 'Perfil', icon: UserCircle2 },
]

export function TechBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-[var(--line)] bg-[var(--bg-1)]">
      {NAV.map(({ href, label, icon: Icon }) => {
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
