import type { Metadata } from 'next'
import { TenantLogo } from '@/components/ui/TenantLogo'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Entrar' }

type Props = {
  searchParams: Promise<{ expired?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { expired } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-line bg-bg-1 p-8 shadow-card flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Glow effect topo do card */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-grad opacity-70" />

        <TenantLogo />

        <div className="text-center">
          <h1 className="text-2xl font-display font-bold">Acesso ao Hub</h1>
          <p className="text-text-2 text-sm mt-1">Entre com suas credenciais para continuar</p>
        </div>

        {expired === '1' && (
          <p className="w-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center text-xs text-yellow-400">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}

        <LoginForm />
      </div>
    </main>
  )
}
