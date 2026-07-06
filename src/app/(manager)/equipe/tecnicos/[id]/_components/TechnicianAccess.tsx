'use client'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  createTechnicianLogin,
  setTechnicianUserAtivo,
  resetTechnicianPassword,
} from '../../actions'

type LinkedUser = { id: string; email: string; ativo: boolean } | null

type Props = {
  technicianId: string
  email: string
  user: LinkedUser
}

export function TechnicianAccess({ technicianId, email, user }: Props) {
  const [state, formAction, isPending] = useActionState(
    createTechnicianLogin.bind(null, technicianId),
    { error: null as string | null },
  )

  return (
    <div className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Acesso ao portal do técnico
        </h2>
        {user && (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              user.ativo
                ? 'bg-[rgba(46,230,168,0.12)] text-[var(--green)]'
                : 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]'
            }`}
          >
            {user.ativo ? 'Ativo' : 'Bloqueado'}
          </span>
        )}
      </div>

      {user ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-[var(--text-2)]">
            Login: <span className="font-mono text-[var(--text)]">{user.email}</span>
          </p>
          <div className="flex items-center gap-3">
            <form action={resetTechnicianPassword.bind(null, user.email, technicianId)}>
              <button
                type="submit"
                className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
              >
                Resetar senha
              </button>
            </form>
            <form action={setTechnicianUserAtivo.bind(null, user.id, !user.ativo, technicianId)}>
              <button
                type="submit"
                className={`text-xs font-medium transition-colors ${
                  user.ativo
                    ? 'text-[var(--red)] hover:text-[var(--red)]/80'
                    : 'text-[var(--green)] hover:text-[var(--green)]/80'
                }`}
              >
                {user.ativo ? 'Bloquear' : 'Reativar'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <p className="w-full text-sm text-[var(--text-3)]">
            Este técnico ainda não tem login. Crie um acesso para ele usar o portal.
          </p>
          <div>
            <Label htmlFor="email" className="mb-1.5 block text-xs text-[var(--text-3)]">
              E-mail
            </Label>
            <Input id="email" name="email" type="email" defaultValue={email} required className="w-64" />
          </div>
          <div>
            <Label htmlFor="senhaInicial" className="mb-1.5 block text-xs text-[var(--text-3)]">
              Senha inicial
            </Label>
            <Input
              id="senhaInicial"
              name="senhaInicial"
              type="password"
              minLength={8}
              required
              placeholder="mín. 8 caracteres"
              className="w-56"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Criando…' : 'Criar acesso'}
          </Button>
          {state.error && <p className="w-full text-xs text-[var(--red)]">{state.error}</p>}
        </form>
      )}
    </div>
  )
}
