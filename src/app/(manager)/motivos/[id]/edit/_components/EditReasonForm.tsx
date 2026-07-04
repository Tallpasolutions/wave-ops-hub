'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateReason } from '../../../actions'
import type { ReasonCategoria } from '@/db/schema'
import { CATEGORIA_CLASSIFICAVEL_OPTIONS } from '@/lib/reasons/categoria'

type Reason = {
  id: string
  motivo_original: string
  motivo_normalizado: string
  categoria: ReasonCategoria
  paga_improdutiva: boolean
  valor_improdutiva: string | null
  observacao: string | null
}

type Props = { reason: Reason }

const CATEGORIA_OPTIONS = CATEGORIA_CLASSIFICAVEL_OPTIONS

export function EditReasonForm({ reason }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateReason.bind(null, reason.id),
    { error: null, success: false },
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <Label className="mb-2 block text-xs font-semibold text-[var(--text-3)]">
          Motivo original (read-only)
        </Label>
        <p className="rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-[var(--text-2)]">
          {reason.motivo_original}
        </p>
      </div>

      <div>
        <Label htmlFor="motivoNormalizado" className="mb-2 block text-sm font-medium text-[var(--text)]">
          Motivo normalizado
        </Label>
        <Input
          id="motivoNormalizado"
          name="motivoNormalizado"
          defaultValue={reason.motivo_normalizado}
          placeholder="Ex: Cliente ausente"
        />
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Nome legível exibido no painel e nos relatórios.
        </p>
      </div>

      <div>
        <Label className="mb-3 block text-sm font-medium text-[var(--text)]">Categoria</Label>
        <div className="flex flex-col gap-2">
          {CATEGORIA_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-3 has-[:checked]:border-[var(--cyan)] has-[:checked]:bg-[rgba(0,229,255,0.04)]"
            >
              <input
                type="radio"
                name="categoria"
                value={opt.value}
                defaultChecked={reason.categoria === opt.value}
                className="mt-0.5 accent-[var(--cyan)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{opt.label}</p>
                <p className="text-xs text-[var(--text-3)]">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
        {reason.categoria === 'pendente_classificacao' && (
          <p className="mt-2 text-xs text-[var(--red)]">
            Este motivo ainda não foi classificado. Selecione uma categoria acima.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-3)]">
          Pagamento de improdutiva
        </h3>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="pagaImprodutiva"
            defaultChecked={reason.paga_improdutiva}
            className="h-4 w-4 accent-[var(--cyan)]"
          />
          <span className="text-sm text-[var(--text)]">Paga improdutiva</span>
        </label>

        <div>
          <Label htmlFor="valorImprodutiva" className="mb-1.5 block text-sm text-[var(--text-2)]">
            Valor fixo de improdutiva
          </Label>
          <Input
            id="valorImprodutiva"
            name="valorImprodutiva"
            type="number"
            step="0.01"
            min="0"
            defaultValue={reason.valor_improdutiva ?? ''}
            placeholder="Usa regra da LPU"
          />
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Deixe em branco para usar o valor definido na LPU.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="observacao" className="mb-2 block text-sm font-medium text-[var(--text)]">
          Observação
        </Label>
        <textarea
          id="observacao"
          name="observacao"
          defaultValue={reason.observacao ?? ''}
          rows={3}
          maxLength={500}
          placeholder="Observações internas sobre este motivo (opcional)"
          className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:border-[var(--cyan)] focus:outline-none"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-[rgba(255,84,112,0.1)] px-3 py-2.5 text-sm text-[var(--red)]">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="rounded-lg bg-[rgba(46,230,168,0.1)] px-3 py-2.5 text-sm text-[var(--green)]">
          Motivo salvo com sucesso.
        </p>
      )}

      <Button disabled={isPending} className="self-start">
        {isPending ? 'Salvando…' : 'Salvar motivo'}
      </Button>
    </form>
  )
}
