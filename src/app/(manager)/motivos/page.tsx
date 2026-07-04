import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ReasonCategoria } from '@/db/schema'
import { CATEGORIA_LABEL, CATEGORIA_BADGE_CLASS } from '@/lib/reasons/categoria'
import { OsListSheet } from './_components/OsListSheet'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Improdutivas' }

type ReasonRow = {
  id: string
  motivo_original: string
  motivo_normalizado: string
  categoria: ReasonCategoria
  paga_improdutiva: boolean
  valor_improdutiva: string | null
}

const CATEGORIAS_VALIDAS: ReasonCategoria[] = [
  'falha_tecnico',
  'falha_cliente',
  'forca_maior',
  'falha_sistema',
  'pendente_classificacao',
]

type FilterChip = {
  label: string
  value: string | null
}

const FILTER_CHIPS: FilterChip[] = [
  { label: 'Todos', value: null },
  { label: CATEGORIA_LABEL.falha_tecnico, value: 'falha_tecnico' },
  { label: CATEGORIA_LABEL.falha_cliente, value: 'falha_cliente' },
  { label: CATEGORIA_LABEL.forca_maior, value: 'forca_maior' },
  { label: CATEGORIA_LABEL.falha_sistema, value: 'falha_sistema' },
  { label: 'Pendentes', value: 'pendente_classificacao' },
]

function CategoriaBadge({ categoria }: { categoria: ReasonCategoria }) {
  const label = CATEGORIA_LABEL[categoria]
  const badgeClass = CATEGORIA_BADGE_CLASS[categoria]
  const isPending = categoria === 'pendente_classificacao'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClass} ${isPending ? 'animate-pulse' : ''}`}
    >
      {label}
    </span>
  )
}

export default async function MotivosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; sheet?: string }>
}) {
  const { categoria, sheet } = await searchParams
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()

  const categoriaFiltro =
    categoria && (CATEGORIAS_VALIDAS as string[]).includes(categoria)
      ? (categoria as ReasonCategoria)
      : undefined

  let query = supabase
    .from('reasons')
    .select(
      'id, motivo_original, motivo_normalizado, categoria, paga_improdutiva, valor_improdutiva',
    )
    .order('categoria')
    .order('motivo_original')

  if (categoriaFiltro) {
    query = query.eq('categoria', categoriaFiltro)
  }

  const { data: reasons } = await query

  const { count: totalPendentes } = await supabase
    .from('reasons')
    .select('*', { count: 'exact', head: true })
    .eq('categoria', 'pendente_classificacao')

  const list = (reasons ?? []) as ReasonRow[]

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">
            Visitas Improdutivas
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {list.length} {list.length === 1 ? 'motivo' : 'motivos'}
            {!categoriaFiltro && (totalPendentes ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[rgba(255,84,112,0.13)] px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
                {totalPendentes ?? 0} pendente{(totalPendentes ?? 0) !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const isActive =
            chip.value === null ? !categoriaFiltro : categoriaFiltro === chip.value
          const href = chip.value ? `/motivos?categoria=${chip.value}` : '/motivos'
          return (
            <Link
              key={chip.value ?? 'all'}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--cyan)] text-[var(--bg)]'
                  : 'bg-white/5 text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text)]'
              }`}
            >
              {chip.label}
            </Link>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-8 text-center">
          <p className="text-sm text-[var(--text-3)]">
            {categoriaFiltro
              ? 'Nenhum motivo encontrado para este filtro.'
              : 'Nenhum motivo cadastrado. Os motivos são criados automaticamente durante a ingestão de planilhas.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg-1)]">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Motivo original
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Normalizado
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Categoria
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
                  Paga improdutiva
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="bg-[var(--bg)]">
              {list.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--line)] last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="max-w-[260px] px-5 py-3">
                    <span className="block truncate font-mono text-xs text-[var(--text-2)]">
                      {r.motivo_original}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--text)]">{r.motivo_normalizado}</td>
                  <td className="px-5 py-3">
                    <CategoriaBadge categoria={r.categoria} />
                  </td>
                  <td className="px-5 py-3 text-[var(--text-2)]">
                    {r.paga_improdutiva ? (
                      <span className="text-[var(--green)]">
                        Sim{r.valor_improdutiva ? ` (R$ ${parseFloat(r.valor_improdutiva).toFixed(2)})` : ''}
                      </span>
                    ) : (
                      <span className="text-[var(--text-3)]">Não</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/motivos${categoriaFiltro ? `?categoria=${categoriaFiltro}&` : '?'}sheet=${r.id}`}
                      className="mr-3 text-xs text-[var(--cyan)] underline-offset-2 hover:underline"
                    >
                      Visitas
                    </Link>
                    <Link
                      href={`/motivos/${r.id}/edit`}
                      className="text-xs text-[var(--blue)] underline-offset-2 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sheet &&
        (() => {
          const selected = list.find((r) => r.id === sheet)
          if (!selected) return null
          return (
            <OsListSheet
              reasonId={selected.id}
              reasonLabel={selected.motivo_normalizado ?? selected.motivo_original}
            />
          )
        })()}
    </div>
  )
}
