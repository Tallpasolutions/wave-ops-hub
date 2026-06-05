'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'
import { TenantLogo } from '@/components/ui/TenantLogo'
import { signOut } from '@/lib/auth/logout'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/users', label: 'Usuários', icon: Users },
] as const

interface SidebarProps {
  nomeCompleto: string
  email: string
  onClose?: () => void
}

export function Sidebar({ nomeCompleto, email, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-1)]">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-5">
        <TenantLogo variant="mark" />
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--text)]">
            Tallpa
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
            Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-l-2 border-[var(--cyan)] bg-[var(--grad-soft)] pl-[10px] text-[var(--cyan)]'
                  : 'text-[var(--text-2)] hover:bg-white/5 hover:text-[var(--text)]'
              }`}
            >
              <Icon size={16} />
              {label}
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
