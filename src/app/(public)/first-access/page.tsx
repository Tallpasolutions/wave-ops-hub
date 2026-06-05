import type { Metadata } from 'next'
import { TenantLogo } from '@/components/ui/TenantLogo'
import { FirstAccessForm } from './FirstAccessForm'

export const metadata: Metadata = { title: 'Primeiro Acesso' }

export default function FirstAccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-line bg-bg-1 p-8 shadow-card flex flex-col items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-grad opacity-70" />

        <TenantLogo />

        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Primeiro acesso</h1>
          <p className="text-text-2 text-sm mt-1">
            Bem-vindo! Defina sua senha para ativar sua conta
          </p>
        </div>

        <FirstAccessForm />
      </div>
    </main>
  )
}
