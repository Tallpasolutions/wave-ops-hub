'use client'
import { useActionState, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type FormState = { error: string | null; success: boolean }
type SetPasswordAction = (prevState: FormState, formData: FormData) => Promise<FormState>

type Props = {
  nome: string
  email: string
  action: SetPasswordAction
  triggerLabel?: string
}

export function SetPasswordDialog({ nome, email, action, triggerLabel = 'Definir senha' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
      >
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir nova senha</DialogTitle>
            <DialogDescription>
              {nome} · <span className="font-mono">{email}</span>
            </DialogDescription>
          </DialogHeader>
          <SetPasswordForm action={action} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function SetPasswordForm({ action, onDone }: { action: SetPasswordAction; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
    success: false,
  })
  const [visivel, setVisivel] = useState(false)

  if (state.success) {
    return (
      <div>
        <p className="text-sm text-[var(--green)]">
          Senha definida. O usuário já pode entrar com a senha nova.
        </p>
        <DialogFooter>
          <Button type="button" size="sm" onClick={onDone}>
            Fechar
          </Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-[var(--text-3)]">
        A senha passa a valer imediatamente, sem e-mail de confirmação. Combine a senha com a pessoa
        por um canal seguro.
      </p>

      <div>
        <label
          htmlFor="novaSenha"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
        >
          Nova senha
        </label>
        <div className="relative">
          <input
            id="novaSenha"
            name="novaSenha"
            type={visivel ? 'text' : 'password'}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 pr-10 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] transition-colors hover:text-[var(--text-2)]"
          >
            {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmarSenha"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
        >
          Confirmar senha
        </label>
        <input
          id="confirmarSenha"
          name="confirmarSenha"
          type={visivel ? 'text' : 'password'}
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="Repita a senha"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>

      {state.error && <p className="text-xs text-[var(--red)]">{state.error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Definir senha'}
        </Button>
      </DialogFooter>
    </form>
  )
}
