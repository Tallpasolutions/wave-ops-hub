import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ImprodutivasTable } from './_components/ImprodutivasTable'
import type { ImprodutivaRow } from './_components/ImprodutivasTable'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Aprovação de Improdutivas' }

type Props = {
  searchParams: Promise<{ tecnico?: string; mes?: string }>
}

export default async function ImprodutivasPage({ searchParams }: Props) {
  const { tecnico, mes } = await searchParams
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from('payouts')
    .select(
      `id, valor_calculado, technician_id,
       service_visits!inner(os_num, data_execucao),
       technicians(id, nome),
       reasons!inner(motivo_normalizado, motivo_original, categoria)`,
    )
    .eq('tenant_id', user.tenantId!)
    .is('improdutiva_aprovada', null)
    .not('reason_id', 'is', null)

  if (tecnico) {
    query = query.eq('technician_id', tecnico)
  }

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [year, month] = mes.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    query = query.gte('service_visits.data_execucao', start).lt('service_visits.data_execucao', end)
  }

  const { data: raw } = await query.order('service_visits(data_execucao)', { ascending: false })

  const rows: ImprodutivaRow[] = (raw ?? []).map((p) => {
    const visit = p.service_visits as unknown as { os_num: number; data_execucao: string }
    const tech = p.technicians as unknown as { id: string; nome: string } | null
    const reason = p.reasons as unknown as {
      motivo_normalizado: string | null
      motivo_original: string
      categoria: string
    }
    return {
      id: p.id,
      osNum: Number(visit.os_num),
      dataExecucao: visit.data_execucao,
      tecnicoId: tech?.id ?? null,
      tecnicoNome: tech?.nome ?? null,
      motivo: reason.motivo_normalizado ?? reason.motivo_original,
      categoria: reason.categoria,
      valorCalculado: p.valor_calculado !== null ? Number(p.valor_calculado) : null,
    }
  })

  const technicianOptions = Array.from(
    new Map(rows.filter((r) => r.tecnicoId).map((r) => [r.tecnicoId!, r.tecnicoNome!])).entries(),
  ).map(([id, nome]) => ({ id, nome }))

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">
          Aprovação de Improdutivas
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          {rows.length} {rows.length === 1 ? 'visita pendente' : 'visitas pendentes'} de decisão
        </p>
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Técnico
          </label>
          <select
            name="tecnico"
            defaultValue={tecnico ?? ''}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)]"
          >
            <option value="">Todos</option>
            {technicianOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Período
          </label>
          <input
            type="month"
            name="mes"
            defaultValue={mes ?? ''}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--cyan)] px-4 py-1.5 text-xs font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
        >
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma improdutiva pendente de aprovação"
          description="Quando houver visitas improdutivas aguardando decisão, elas aparecerão aqui."
        />
      ) : (
        <ImprodutivasTable rows={rows} />
      )}
    </div>
  )
}
