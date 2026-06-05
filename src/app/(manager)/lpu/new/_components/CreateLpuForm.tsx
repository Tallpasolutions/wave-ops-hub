'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createLpu } from '../../actions'

const initialState = { error: null as string | null }

export function CreateLpuForm() {
  const [state, formAction, isPending] = useActionState(createLpu, initialState)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <Link
          href="/lpu"
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Voltar para LPU
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Nova LPU</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Crie uma LPU como rascunho e adicione as regras antes de ativá-la.
        </p>
      </div>

      <div className="max-w-lg rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="nome"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              Nome <span className="text-[var(--red)]">*</span>
            </Label>
            <Input
              id="nome"
              name="nome"
              type="text"
              placeholder="Ex: LPU Wave 2026"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="vigenciaInicio"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                Início da vigência <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                id="vigenciaInicio"
                name="vigenciaInicio"
                type="date"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="vigenciaFim"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                Fim da vigência
              </Label>
              <Input
                id="vigenciaFim"
                name="vigenciaFim"
                type="date"
              />
              <p className="text-[11px] text-[var(--text-3)]">Deixe em branco se ainda vigente</p>
            </div>
          </div>

          {state.error && (
            <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2 text-sm text-[var(--red)]">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Criando…' : 'Criar LPU'}
            </Button>
            <Link href="/lpu">
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
