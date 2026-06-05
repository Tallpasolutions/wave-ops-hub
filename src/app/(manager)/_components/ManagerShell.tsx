'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { ManagerSidebar } from './Sidebar'

interface ManagerShellProps {
  nomeCompleto: string
  email: string
  tenantNome: string
  topbar: React.ReactNode
  children: React.ReactNode
}

export function ManagerShell({ nomeCompleto, email, tenantNome, topbar, children }: ManagerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <ManagerSidebar nomeCompleto={nomeCompleto} email={email} tenantNome={tenantNome} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <ManagerSidebar
              nomeCompleto={nomeCompleto}
              email={email}
              tenantNome={tenantNome}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center border-b border-[var(--line)] bg-[var(--bg-1)] px-5">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 flex items-center justify-center rounded-lg p-1.5 text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex flex-1 items-center justify-between">
            {topbar}
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
