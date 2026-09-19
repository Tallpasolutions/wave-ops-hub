'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ESCALAS, TIPOS_RESPOSTA } from '@/lib/supervisao'

// Campos compartilhados entre criar e editar — para os dois formulários não divergirem em
// rótulo, ajuda ou validação, que é como telas parecidas passam a se comportar diferente.
export type ValoresItem = {
  titulo?: string
  codigo?: string | null
  descricao?: string | null
  categoria?: string | null
  peso?: string | number
  ordem?: number
  tipoResposta?: string
  fotoObrigatoria?: boolean
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

      <div>
        <Label htmlFor="tipoResposta" className={rotulo}>
          Como o supervisor responde <span className="text-[var(--red)]">*</span>
        </Label>
        <select
          id="tipoResposta"
          name="tipoResposta"
          defaultValue={valores?.tipoResposta ?? 'conformidade'}
          className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--cyan)]"
        >
          {TIPOS_RESPOSTA.map((t) => (
            <option key={t} value={t}>
              {ESCALAS[t].nome} — {ESCALAS[t].opcoes.map((o) => o.label).join(' · ')}
            </option>
          ))}
        </select>
        <p className={ajuda}>
          Muda só o texto dos botões em campo. A nota é calculada igual nos três casos: a
          primeira opção conta como acerto.
        </p>
      </div>

      {/* Quem decide se o item exige foto é o GESTOR, aqui — não o supervisor em campo.
          Sem isso, a evidência vira opcional e some justamente no item que importa. */}
      <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="fotoObrigatoria"
            value="on"
            defaultChecked={valores?.fotoObrigatoria ?? false}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--cyan)]"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--text)]">Exige foto</span>
            <span className={ajuda + ' block'}>
              O supervisor não consegue concluir a supervisão sem anexar foto neste item. Use
              em itens de risco de vida e no que precisa de prova, não em tudo — exigir foto
              demais faz o preenchimento em campo travar.
            </span>
          </span>
        </label>
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
