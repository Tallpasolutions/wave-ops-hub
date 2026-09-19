'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Campos compartilhados entre criar e editar — para os dois formulários não divergirem em
// rótulo, ajuda ou validação, que é como telas parecidas passam a se comportar diferente.
export type ValoresItem = {
  titulo?: string
  codigo?: string | null
  descricao?: string | null
  categoria?: string | null
  peso?: string | number
  ordem?: number
}

const rotulo = 'mb-2 block text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--text-3)]'
const ajuda = 'mt-1.5 text-xs text-[var(--text-3)]'

export function ChecklistItemFields({ valores }: { valores?: ValoresItem }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="titulo" className={rotulo}>
          O que o supervisor verifica <span className="text-[var(--red)]">*</span>
        </Label>
        <Input
          id="titulo"
          name="titulo"
          defaultValue={valores?.titulo ?? ''}
          placeholder="Ex: Técnico usando EPI completo"
          required
        />
        <p className={ajuda}>
          Escreva como uma afirmação que possa ser respondida com conforme ou não conforme.
        </p>
      </div>

      <div>
        <Label htmlFor="descricao" className={rotulo}>
          Detalhamento
        </Label>
        <textarea
          id="descricao"
          name="descricao"
          defaultValue={valores?.descricao ?? ''}
          rows={3}
          placeholder="O que olhar para decidir. Aparece junto do item na tela do supervisor."
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--cyan)]"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="categoria" className={rotulo}>
            Categoria
          </Label>
          <Input
            id="categoria"
            name="categoria"
            defaultValue={valores?.categoria ?? ''}
            placeholder="Ex: Segurança"
          />
          <p className={ajuda}>Agrupa os itens na tela. Texto livre.</p>
        </div>

        <div>
          <Label htmlFor="codigo" className={rotulo}>
            Código
          </Label>
          <Input
            id="codigo"
            name="codigo"
            defaultValue={valores?.codigo ?? ''}
            placeholder="Ex: EPI-01"
          />
          <p className={ajuda}>Opcional, para referenciar em treinamento. Único no tenant.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="peso" className={rotulo}>
            Peso <span className="text-[var(--red)]">*</span>
          </Label>
          <Input
            id="peso"
            name="peso"
            type="number"
            step="0.5"
            min="0.5"
            defaultValue={valores?.peso !== undefined ? String(Number(valores.peso)) : '1'}
            required
          />
          <p className={ajuda}>
            Quanto este item vale na nota. Deixe 1 na dúvida — a nota vira a proporção simples
            de itens conformes. Use mais que 1 para item crítico.
          </p>
        </div>

        <div>
          <Label htmlFor="ordem" className={rotulo}>
            Ordem <span className="text-[var(--red)]">*</span>
          </Label>
          <Input
            id="ordem"
            name="ordem"
            type="number"
            step="1"
            min="0"
            defaultValue={valores?.ordem ?? 0}
            required
          />
          <p className={ajuda}>
            Posição na lista que o supervisor preenche. Dá para reordenar depois pelas setas.
          </p>
        </div>
      </div>
    </div>
  )
}
