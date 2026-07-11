import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PAID_STATUSES, payoutValor } from '../_lib/points'

export const metadata: Metadata = { title: 'Minha Equipe' }
export const dynamic = 'force-dynamic'

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

export default async function MinhaEquipePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'tenant_supervisor') redirect('/')

  const supabase = await createSupabaseServerClient()

  const { data: supervisorTeam } = await supabase
    .from('supervisor_technicians')
    .select('technician_id, technicians(id, nome_completo)')
    .eq('supervisor_id', user.id)

  if (!supervisorTeam?.length) {
    return (
      <div className="p-4 lg:p-8">
        <h1 className="font-display mb-2 text-2xl font-bold text-[var(--text)]">Minha Equipe</h1>
        <p className="text-sm text-[var(--text-3)]">
          Nenhum técnico foi atribuído à sua equipe ainda.
        </p>
      </div>
    )
  }

  const technicianIds = supervisorTeam.map((r) => r.technician_id)

  // Período = último mês com visitas da equipe (não o mês corrente vazio)
  const { data: ultima } = await supabase
    .from('service_visits')
    .select('data_execucao')
    .eq('tenant_id', user.tenantId!)
    .in('tecnico_id', technicianIds)
    .eq('fora_escopo', false)
    .order('data_execucao', { ascending: false })
    .limit(1)
    .maybeSingle()
  const ym = (ultima?.data_execucao ?? new Date().toISOString()).slice(0, 7)
  const [yy, mm] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = `${mm === 12 ? yy + 1 : yy}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-01`
  const mesLabel = new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const [{ data: visits }, { data: payouts }] = await Promise.all([
    supabase
      .from('service_visits')
      .select('tecnico_id, sucesso')
      .eq('tenant_id', user.tenantId!)
      .in('tecnico_id', technicianIds)
      .eq('fora_escopo', false)
      .gte('data_execucao', start)
      .lt('data_execucao', end),
    // Payout pela DATA DA VISITA (não created_at) — mesma base do gestor
    supabase
      .from('payouts')
      .select(
        'technician_id, status, valor_calculado, valor_override, valor_deixado_na_mesa, service_visits!inner(data_execucao)',
      )
      .eq('tenant_id', user.tenantId!)
      .in('technician_id', technicianIds)
      .gte('service_visits.data_execucao', start)
      .lt('service_visits.data_execucao', end),
  ])

  type KpiRow = {
    technicianId: string
    nome: string
    totalVisitas: number
    taxaSucesso: number
    totalPayout: number
    deixadoNaMesa: number
  }

  const kpis: KpiRow[] = supervisorTeam.map((row) => {
    const tech = (Array.isArray(row.technicians) ? row.technicians[0] : row.technicians) as
      | { id: string; nome_completo: string }
      | null

    const tid = row.technician_id
    const techVisits = (visits ?? []).filter((v) => v.tecnico_id === tid)
    const techPayouts = (payouts ?? []).filter((p) => p.technician_id === tid)

    const total = techVisits.length
    const successCount = techVisits.filter((v) => isSuccess(v.sucesso)).length
    const taxa = total > 0 ? Math.round((successCount / total) * 100) : 0

    const totalPayout = techPayouts
      .filter((p) => PAID_STATUSES.includes((p as { status: string }).status))
      .reduce((sum, p) => sum + payoutValor(p), 0)

    const deixadoNaMesa = techPayouts.reduce(
      (sum, p) => sum + (p.valor_deixado_na_mesa ?? 0),
      0,
    )

    return {
      technicianId: tid,
      nome: tech?.nome_completo ?? tid,
      totalVisitas: total,
      taxaSucesso: taxa,
      totalPayout,
      deixadoNaMesa,
    }
  })

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Minha Equipe</h1>
        <p className="mt-1 text-sm capitalize text-[var(--text-3)]">{mesLabel}</p>
      </div>

      <div className="flex flex-col gap-3">
        {kpis.sort((a, b) => b.totalPayout - a.totalPayout).map((k) => (
          <div
            key={k.technicianId}
            className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5"
          >
            <p className="mb-4 font-medium text-[var(--text)]">{k.nome}</p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Visitas
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">{k.totalVisitas}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Taxa sucesso
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    k.taxaSucesso >= 80
                      ? 'text-[var(--green)]'
                      : k.taxaSucesso >= 60
                        ? 'text-[var(--yellow,#ffab00)]'
                        : 'text-[var(--red)]'
                  }`}
                >
                  {k.taxaSucesso}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Payout
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {k.totalPayout.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Deixado na mesa
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--red)]">
                  {k.deixadoNaMesa > 0
                    ? k.deixadoNaMesa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
