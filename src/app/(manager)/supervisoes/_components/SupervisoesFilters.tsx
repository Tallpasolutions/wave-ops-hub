import Link from 'next/link'
import { supervisaoStatusLabel } from '@/lib/labels/supervisao'
import { STATUS_VALIDOS, urlComFiltro, temFiltroAtivo } from '../_lib/filters'
import type { FiltrosSupervisao } from '../_lib/filters'

type Props = { filtros: FiltrosSupervisao }

// Filtros por link, não por formulário: o estado fica na URL, então o gestor pode compartilhar
// a visão filtrada e o voltar do navegador funciona. Mesmo princípio do drill-down do
// dashboard (ADR-010).
export function SupervisoesFilters({ filtros }: Props) {
  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      ativo
        ? 'bg-[var(--cyan)] text-[#04121a]'
        : 'bg-white/5 text-[var(--text-2)] hover:bg-white/10'
    }`

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Link href={urlComFiltro(filtros, 'status', null)} className={chip(!filtros.status)}>
        Todas
      </Link>

      {STATUS_VALIDOS.map((s) => (
        <Link
          key={s}
          href={urlComFiltro(filtros, 'status', s)}
          className={chip(filtros.status === s)}
        >
          {supervisaoStatusLabel(s).curto}
        </Link>
      ))}

      {temFiltroAtivo(filtros) && (
        <Link
          href="/supervisoes"
          className="ml-1 text-xs text-[var(--text-3)] underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline"
        >
          Limpar filtros
        </Link>
      )}
    </div>
  )
}
