'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

interface AdminShellProps {
  nomeCompleto: string
  email: string
  children: React.ReactNode
}

export function AdminShell({ nomeCompleto, email, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar nomeCompleto={nomeCompleto} email={email} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar
              nomeCompleto={nomeCompleto}
              email={email}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar mobile-only com hambúrguer */}
        <div className="flex h-11 shrink-0 items-center border-b border-[var(--line)] bg-[var(--bg-1)] px-5 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center rounded-lg p-1.5 text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <span className="ml-3 font-display text-xs font-bold uppercase tracking-widest text-[var(--text)]">
            Admin
          </span>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
