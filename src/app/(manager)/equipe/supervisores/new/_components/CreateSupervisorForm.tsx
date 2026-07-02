'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { createSupervisor } from '../../actions'

type Technician = { id: string; nome: string }

type Props = {
  techniciansAvailable: Technician[]
  techniciansAll: Technician[]
}

export function CreateSupervisorForm({ techniciansAvailable, techniciansAll }: Props) {
  const [state, formAction, isPending] = useActionState(createSupervisor, { error: null as string | null })
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [supervisedIds, setSupervisedIds] = useState<string[]>([])

  function toggleSupervised(id: string) {
    setSupervisedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const teamCandidates = techniciansAll.filter((t) => t.id !== selectedTechnicianId)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/equipe/supervisores"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Supervisores
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo Supervisor</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Vincula um técnico existente como líder de equipe.
        </p>
      </div>

      <form action={formAction} className="flex max-w-2xl flex-col gap-6">
        {supervisedIds.map((id) => (
          <input key={id} type="hidden" name="supervisedIds" value={id} />
        ))}

        <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Técnico supervisor
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]">
                Técnico <span className="text-[var(--red)]">*</span>
              </Label>
              {techniciansAvailable.length === 0 ? (
                <p className="text-sm text-[var(--text-3)]">
                  Todos os técnicos ativos já possuem conta de supervisor.
                </p>
              ) : (
                <select
                  name="technicianId"
                  value={selectedTechnicianId}
                  onChange={(e) => {
                    setSelectedTechnicianId(e.target.value)
                    setSupervisedIds((prev) => prev.filter((id) => id !== e.target.value))
                  }}
                  required
                  className="h-10 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]"
                >
                  <option value="">Selecione um técnico</option>
                  {techniciansAvailable.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                E-mail de acesso <span className="text-[var(--red)]">*</span>
              </Label>
              <Input id="email" name="email" type="email" placeholder="supervisor@email.com" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label
                htmlFor="senhaInicial"
                className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]"
              >
                Senha inicial <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                id="senhaInicial"
                name="senhaInicial"
                type="password"
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Equipe supervisionada
          </p>
          <p className="mb-4 text-xs text-[var(--text-3)]">Opcional. Pode ser editado depois.</p>

          {teamCandidates.length === 0 ? (
            <p className="text-sm text-[var(--text-3)]">Nenhum outro técnico disponível.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {teamCandidates.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={supervisedIds.includes(t.id)}
                    onCheckedChange={() => toggleSupervised(t.id)}
                  />
                  <span className="text-sm text-[var(--text)]">{t.nome}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {state.error && (
          <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2.5 text-sm text-[var(--red)]">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending || techniciansAvailable.length === 0}
            className="flex-1"
          >
            {isPending ? 'Criando…' : 'Criar Supervisor'}
          </Button>
          <Link href="/equipe/supervisores">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
