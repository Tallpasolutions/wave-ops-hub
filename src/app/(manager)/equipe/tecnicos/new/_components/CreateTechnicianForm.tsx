'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createTechnician } from '../../actions'

const initialState = { error: null as string | null }

type Props = {
  defaultNomeCompleto?: string
  from?: string
}

export function CreateTechnicianForm({ defaultNomeCompleto, from }: Props) {
  const [state, formAction, isPending] = useActionState(createTechnician, initialState)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <Link
          href="/equipe/tecnicos"
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Voltar para Técnicos
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo Técnico</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">Cadastre um novo técnico de campo</p>
      </div>

      <div className="max-w-lg rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-6">
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="nomeCompleto"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              Nome completo <span className="text-[var(--red)]">*</span>
            </Label>
            <Input
              id="nomeCompleto"
              name="nomeCompleto"
              type="text"
              placeholder="Nome Sobrenome"
              defaultValue={defaultNomeCompleto ?? ''}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="email"
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
            >
              E-mail <span className="text-[var(--red)]">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tecnico@empresa.com"
              required
            />
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Dados complementares — podem ser preenchidos depois
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="cpf"
                  className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
                >
                  CPF
                </Label>
                <Input id="cpf" name="cpf" type="text" placeholder="000.000.000-00" />
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="celular"
                  className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
                >
                  Celular
                </Label>
                <Input id="celular" name="celular" type="text" placeholder="(00) 90000-0000" />
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="codigoUnetvale"
                  className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
                >
                  Código Unetvale
                </Label>
                <Input
                  id="codigoUnetvale"
                  name="codigoUnetvale"
                  type="text"
                  placeholder="Ex: UNT-1234"
                />
              </div>
            </div>
          </div>

          {state.error && (
            <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2 text-sm text-[var(--red)]">
              {state.error}
            </p>
          )}

          <input type="hidden" name="from" value={from ?? ''} />

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Cadastrando…' : 'Cadastrar Técnico'}
            </Button>
            <Link href="/equipe/tecnicos">
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
