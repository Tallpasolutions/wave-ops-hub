import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Minha Equipe' }
export const dynamic = 'force-dynamic'

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

export default async function MinhaEquipePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'tenant_supervisor') redirect('/')

  const now = new Date()
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const supabase = await createSupabaseServerClient()

  const { data: supervisorTeam } = await supabase
    .from('supervisor_technicians')
    .select('technician_id, technicians(id, nome)')
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

  const [{ data: visits }, { data: payouts }] = await Promise.all([
    supabase
      .from('service_visits')
      .select('tecnico_id, sucesso')
      .eq('tenant_id', user.tenantId!)
      .in('tecnico_id', technicianIds)
      .gte('data_execucao', mesInicio)
      .lte('data_execucao', mesFim),
    supabase
      .from('payouts')
      .select('technician_id, valor_calculado, valor_override, valor_deixado_na_mesa')
      .eq('tenant_id', user.tenantId!)
      .in('technician_id', technicianIds)
      .gte('created_at', mesInicio)
      .lte('created_at', mesFim),
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
      | { id: string; nome: string }
      | null

    const tid = row.technician_id
    const techVisits = (visits ?? []).filter((v) => v.tecnico_id === tid)
    const techPayouts = (payouts ?? []).filter((p) => p.technician_id === tid)

    const total = techVisits.length
    const successCount = techVisits.filter((v) => isSuccess(v.sucesso)).length
    const taxa = total > 0 ? Math.round((successCount / total) * 100) : 0

    const totalPayout = techPayouts.reduce((sum, p) => {
      const val = p.valor_override !== null ? p.valor_override : (p.valor_calculado ?? 0)
      return sum + val
    }, 0)

    const deixadoNaMesa = techPayouts.reduce(
      (sum, p) => sum + (p.valor_deixado_na_mesa ?? 0),
      0,
    )

    return {
      technicianId: tid,
      nome: tech?.nome ?? tid,
      totalVisitas: total,
      taxaSucesso: taxa,
      totalPayout,
      deixadoNaMesa,
    }
  })

  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

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
