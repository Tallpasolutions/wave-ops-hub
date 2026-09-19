import Link from 'next/link'
import { ChevronUp, ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toggleChecklistItem, moveChecklistItem } from '../actions'
import type { ChecklistItemRow } from '../page'

type Props = { itens: ChecklistItemRow[] }

export function ChecklistItemsTable({ itens }: Props) {
  const ativos = itens.filter((i) => i.ativo)
  const inativos = itens.filter((i) => !i.ativo)

  return (
    <div className="flex flex-col gap-8">
      <Secao
        titulo="Itens ativos"
        descricao="São estes que entram nas próximas supervisões, nesta ordem."
        itens={ativos}
        mostrarSetas
        totalAtivos={ativos.length}
      />

      {inativos.length > 0 && (
        <Secao
          titulo="Itens desativados"
          descricao="Não entram em supervisões novas, mas seguem intactos nas que já existem."
          itens={inativos}
          totalAtivos={ativos.length}
        />
      )}
    </div>
  )
}

function Secao({
  titulo,
  descricao,
  itens,
  mostrarSetas = false,
  totalAtivos,
}: {
  titulo: string
  descricao: string
  itens: ChecklistItemRow[]
  mostrarSetas?: boolean
  totalAtivos: number
}) {
  if (itens.length === 0) return null

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        {titulo}
      </h2>
      <p className="mb-3 mt-1 text-xs text-[var(--text-3)]">{descricao}</p>

      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <Table>
          <TableHeader>
            <TableRow>
              {mostrarSetas && <TableHead className="w-[70px]">Ordem</TableHead>}
              <TableHead>Item</TableHead>
              <TableHead className="w-[130px]">Categoria</TableHead>
              <TableHead className="w-[80px]">Peso</TableHead>
              <TableHead className="w-[190px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item, i) => (
              <TableRow key={item.id}>
                {mostrarSetas && (
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <SetaOrdem
                        itemId={item.id}
                        direcao="cima"
                        desabilitada={i === 0}
                      />
                      <SetaOrdem
                        itemId={item.id}
                        direcao="baixo"
                        desabilitada={i === totalAtivos - 1}
                      />
                    </div>
                  </TableCell>
                )}

                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--text)]">
                      {item.codigo && (
                        <span className="mr-2 font-mono text-xs text-[var(--text-3)]">
                          {item.codigo}
                        </span>
                      )}
                      {item.titulo}
                    </span>
                    {item.descricao && (
                      <span className="text-xs text-[var(--text-3)]">{item.descricao}</span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  {item.categoria ? (
                    <Badge variant="secondary">{item.categoria}</Badge>
                  ) : (
                    <span className="text-xs text-[var(--text-3)]">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {/* Peso 1 é o padrão e não merece destaque; o que importa é ver quem foge dele. */}
                  <span
                    className={
                      Number(item.peso) === 1
                        ? 'text-sm text-[var(--text-3)]'
                        : 'text-sm font-semibold text-[var(--text)]'
                    }
                  >
                    {Number(item.peso).toLocaleString('pt-BR')}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/supervisoes/checklist/${item.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-2)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
                    >
                      <Pencil size={13} />
                      Editar
                    </Link>
                    <BotaoAtivar itemId={item.id} ativo={item.ativo} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SetaOrdem({
  itemId,
  direcao,
  desabilitada,
}: {
  itemId: string
  direcao: 'cima' | 'baixo'
  desabilitada: boolean
}) {
  const Icone = direcao === 'cima' ? ChevronUp : ChevronDown
  const mover = moveChecklistItem.bind(null, itemId, direcao)

  return (
    <form action={mover}>
      <button
        type="submit"
        disabled={desabilitada}
        aria-label={direcao === 'cima' ? 'Mover para cima' : 'Mover para baixo'}
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-3)] transition-colors hover:bg-white/5 hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <Icone size={15} />
      </button>
    </form>
  )
}

// Desativar, nunca apagar: as respostas históricas apontam para o item, e a supervisão já
// agendada carrega uma cópia congelada dele.
function BotaoAtivar({ itemId, ativo }: { itemId: string; ativo: boolean }) {
  const alternar = toggleChecklistItem.bind(null, itemId, !ativo)

  return (
    <form action={alternar}>
      <button
        type="submit"
        className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
          ativo
            ? 'text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--red)]'
            : 'text-[var(--green)] hover:bg-[rgba(46,230,168,0.1)]'
        }`}
      >
        {ativo ? 'Desativar' : 'Reativar'}
      </button>
    </form>
  )
}
