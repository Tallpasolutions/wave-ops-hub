import { Camera } from 'lucide-react'
import { labelResposta } from '@/lib/supervisao'
import { respostaLabel } from '@/lib/labels/supervisao'

export type RespostaRow = {
  id: string
  ordem: number
  item_codigo: string | null
  item_titulo: string
  item_categoria: string | null
  item_peso: string
  item_tipo_resposta: string
  item_foto_obrigatoria: boolean
  resposta: string | null
  observacao: string | null
  fotos: number
}

export function ChecklistResultado({ respostas }: { respostas: RespostaRow[] }) {
  // Agrupa por categoria preservando a ordem do snapshot — que é a ordem em que o supervisor
  // preencheu, e a que o gestor espera reencontrar.
  const grupos = new Map<string, RespostaRow[]>()
  for (const r of respostas) {
    const chave = r.item_categoria ?? 'Sem categoria'
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(r)
  }

  return (
    <div className="flex flex-col gap-6">
      {[...grupos.entries()].map(([categoria, itens]) => (
        <section key={categoria}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            {categoria}
            <span className="ml-2 font-normal normal-case tracking-normal">
              {itens.filter((i) => i.resposta === 'conforme').length}/{itens.length} conformes
            </span>
          </h3>

          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            {itens.map((r, i) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                  i > 0 ? 'border-t border-[var(--line)]' : ''
                }`}
              >
                <span className="font-mono text-xs text-[var(--text-3)]">
                  {String(r.ordem).padStart(2, '0')}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text)]">
                    {r.item_codigo && (
                      <span className="mr-2 font-mono text-xs text-[var(--text-3)]">
                        {r.item_codigo}
                      </span>
                    )}
                    {r.item_titulo}
                  </p>
                  {r.observacao && (
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">{r.observacao}</p>
                  )}
                </div>

                {/* Item que exige foto e não tem: o gestor precisa ver isso mesmo depois de
                    concluída — é o que distingue evidência ausente de evidência dispensada. */}
                {r.item_foto_obrigatoria && (
                  <span
                    title={r.fotos > 0 ? `${r.fotos} foto(s)` : 'Exigia foto e não tem'}
                    className={`inline-flex items-center gap-1 text-xs ${
                      r.fotos > 0 ? 'text-[var(--text-2)]' : 'text-[var(--red)]'
                    }`}
                  >
                    <Camera size={12} />
                    {r.fotos > 0 ? r.fotos : '0'}
                  </span>
                )}

                {/* O rótulo vem da ESCALA do item: "Está usando" num item de uso, "Possui e em
                    bom estado" num de posse. A cor vem do significado comum. */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    respostaLabel(r.resposta).cls
                  }`}
                >
                  {labelResposta(r.item_tipo_resposta, r.resposta as never)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
