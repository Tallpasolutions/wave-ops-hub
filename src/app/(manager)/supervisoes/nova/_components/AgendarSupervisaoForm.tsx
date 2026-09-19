'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { agendarSupervisao } from '../../actions'

type Opcao = { id: string; nome: string }

type Props = {
  tecnicos: Opcao[]
  supervisores: Opcao[]
  hoje: string
  itensAtivos: number
}

const rotulo = 'mb-2 block text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]'
const ajuda = 'mt-1.5 text-xs text-[var(--text-3)]'
const campo =
  'h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]'

export function AgendarSupervisaoForm({ tecnicos, supervisores, hoje, itensAtivos }: Props) {
  const [state, formAction, isPending] = useActionState(agendarSupervisao, {
    error: null as string | null,
  })

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="tecnicoId" className={rotulo}>
                Técnico supervisionado <span className="text-[var(--red)]">*</span>
              </Label>
              <select id="tecnicoId" name="tecnicoId" required className={campo}>
                <option value="">Selecione</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="supervisorUserId" className={rotulo}>
                Supervisor responsável <span className="text-[var(--red)]">*</span>
              </Label>
              <select id="supervisorUserId" name="supervisorUserId" required className={campo}>
                <option value="">Selecione</option>
                {supervisores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="dataAgendada" className={rotulo}>
                Data <span className="text-[var(--red)]">*</span>
              </Label>
              <Input
                id="dataAgendada"
                name="dataAgendada"
                type="date"
                defaultValue={hoje}
                required
              />
            </div>

            <div>
              <Label htmlFor="empresa" className={rotulo}>
                Contratante
              </Label>
              <select id="empresa" name="empresa" defaultValue="" className={campo}>
                <option value="">Não informar</option>
                <option value="unifique">Unifique</option>
                <option value="unetvale">Unetvale</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="cluster" className={rotulo}>
                Cluster
              </Label>
              <Input id="cluster" name="cluster" placeholder="Ex: Vale Europeu" />
            </div>

            <div>
              <Label htmlFor="localReferencia" className={rotulo}>
                Local de referência
              </Label>
              <Input id="localReferencia" name="localReferencia" placeholder="Ex: Brusque, centro" />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoesGestor" className={rotulo}>
              Orientação ao supervisor
            </Label>
            <textarea
              id="observacoesGestor"
              name="observacoesGestor"
              rows={3}
              placeholder="O que olhar com atenção nesta supervisão."
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--cyan)]"
            />
            <p className={ajuda}>Aparece para o supervisor no app, antes de ele começar.</p>
          </div>
        </div>
      </section>

      {/* O snapshot é a promessa central do módulo: dizer isso ANTES de agendar evita a
          pergunta "por que a supervisão antiga não mudou quando editei o checklist?". */}
      <p className="rounded-lg border border-[var(--line)] bg-white/[0.02] px-4 py-3 text-sm text-[var(--text-2)]">
        Os <strong className="text-[var(--text)]">{itensAtivos} itens ativos</strong> do
        checklist serão copiados para esta supervisão. Editar o checklist depois não altera o
        que o supervisor vai responder aqui.
      </p>

      {state.error && <p className="text-sm text-[var(--red)]">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Agendando…' : 'Agendar supervisão'}
        </Button>
        <Link
          href="/supervisoes"
          className="text-sm text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
