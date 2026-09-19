import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { iqiByTecnico, teamIqi, competenciaLabel, iqiTone } from '@/lib/iqi'
import type { IqiSnapshotInput } from '@/lib/iqi'
import { PAID_STATUSES, payoutValor } from '../_lib/points'

export const metadata: Metadata = { title: 'Minha Equipe' }
export const dynamic = 'force-dynamic'

const isSuccess = (sucesso: string | null) =>
  sucesso?.trim().toLowerCase().startsWith('sim') ?? false

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Faixas da taxa de sucesso — maior é melhor, ao contrário do IQI.
function corTaxa(taxa: number): string {
  if (taxa >= 80) return 'text-[var(--green)]'
  if (taxa >= 60) return 'text-[var(--amber)]'
  return 'text-[var(--red)]'
}

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

  // Dias do mês já decorridos — denominador da produtividade. Num mês fechado é o mês
  // inteiro; no mês corrente, só até hoje, para não diluir a média.
  const diasNoMes = new Date(Date.UTC(yy, mm, 0)).getUTCDate()
  const hoje = new Date()
  const mesCorrente = hoje.getUTCFullYear() === yy && hoje.getUTCMonth() + 1 === mm
  const diasDecorridos = mesCorrente ? Math.max(1, hoje.getUTCDate()) : diasNoMes

  const [{ data: visits }, { data: payouts }, { data: iqiRows }] = await Promise.all([
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
    // IQI da equipe (ADR-023). A RLS já libera os técnicos supervisionados — nenhuma
    // política precisou mudar para esta tela existir.
    supabase
      .from('iqi_snapshots')
      .select('tecnico_id, competencia, total_os, contratos_reincidentes, pct_reincidencia')
      .eq('tenant_id', user.tenantId!)
      .in('tecnico_id', technicianIds),
  ])

  const iqiInputs: IqiSnapshotInput[] = (iqiRows ?? []).map((r) => ({
    tecnicoId: r.tecnico_id as string,
    competencia: r.competencia as string,
    totalOs: r.total_os as number,
    contratosReincidentes: r.contratos_reincidentes as number,
    pctReincidencia: Number(r.pct_reincidencia),
  }))

  // O IQI vem da Unetvale e nem sempre acompanha o mês das visitas: usa a competência mais
  // recente que existir, e rotula qual é, para o supervisor não achar que é do mês corrente.
  const competenciaIqi = iqiInputs.length
    ? [...new Set(iqiInputs.map((r) => r.competencia))].sort().at(-1)!
    : null
  const iqiPorTecnico = competenciaIqi ? iqiByTecnico(iqiInputs, competenciaIqi) : new Map()
  const iqiEquipe = competenciaIqi ? teamIqi(iqiInputs, competenciaIqi) : null

  type KpiRow = {
    technicianId: string
    nome: string
    totalVisitas: number
    visitasPorDia: number
    taxaSucesso: number
    totalPayout: number
    deixadoNaMesa: number
    iqi: number | null
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

    const snap = iqiPorTecnico.get(tid) as IqiSnapshotInput | undefined

    return {
      technicianId: tid,
      nome: tech?.nome_completo ?? tid,
      totalVisitas: total,
      visitasPorDia: Math.round((total / diasDecorridos) * 10) / 10,
      taxaSucesso: taxa,
      totalPayout,
      deixadoNaMesa,
      iqi: snap ? snap.pctReincidencia : null,
    }
  })

  // Consolidado da equipe. Taxa de sucesso é soma/soma, não média das taxas — média
  // distorceria por técnico com poucas visitas.
  const totalVisitasEquipe = (visits ?? []).length
  const sucessosEquipe = (visits ?? []).filter((v) => isSuccess(v.sucesso)).length
  const taxaEquipe =
    totalVisitasEquipe > 0 ? Math.round((sucessosEquipe / totalVisitasEquipe) * 100) : 0
  const payoutEquipe = kpis.reduce((s, k) => s + k.totalPayout, 0)

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Minha Equipe</h1>
        <p className="mt-1 text-sm capitalize text-[var(--text-3)]">
          {mesLabel} · {kpis.length} {kpis.length === 1 ? 'técnico' : 'técnicos'}
        </p>
      </div>

      {/* Consolidado da equipe */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Visitas
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{totalVisitasEquipe}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
            {(Math.round((totalVisitasEquipe / diasDecorridos) * 10) / 10).toLocaleString('pt-BR')}
            /dia
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Taxa de sucesso
          </p>
          <p className={`mt-1 text-2xl font-bold ${corTaxa(taxaEquipe)}`}>{taxaEquipe}%</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
            {sucessosEquipe} de {totalVisitasEquipe}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Reincidência
          </p>
          {iqiEquipe ? (
            <>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: iqiTone(iqiEquipe.pctReincidencia).fg }}
              >
                {iqiEquipe.pctReincidencia.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}
                %
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                {competenciaLabel(competenciaIqi!)} · {iqiEquipe.contratosReincidentes} de{' '}
                {iqiEquipe.totalOs}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold text-[var(--text-3)]">—</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-3)]">Sem dados</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Pagamento
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--text)]">{brl(payoutEquipe)}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-3)]">Total da equipe</p>
        </div>
      </div>

      {/* Por técnico */}
      <div className="flex flex-col gap-3">
        {kpis
          .sort((a, b) => b.totalPayout - a.totalPayout)
          .map((k) => (
            <div
              key={k.technicianId}
              className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-medium text-[var(--text)]">{k.nome}</p>
                {k.iqi !== null && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: iqiTone(k.iqi).fg, background: iqiTone(k.iqi).bg }}
                  >
                    {iqiTone(k.iqi).label} ·{' '}
                    {k.iqi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Visitas
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--text)]">{k.totalVisitas}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Por dia
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--text)]">
                    {k.visitasPorDia.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Taxa sucesso
                  </p>
                  <p className={`mt-1 text-xl font-bold ${corTaxa(k.taxaSucesso)}`}>
                    {k.taxaSucesso}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Pagamento
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--text)]">{brl(k.totalPayout)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                    Deixado na mesa
                  </p>
                  <p className="mt-1 text-xl font-bold text-[var(--red)]">
                    {k.deixadoNaMesa > 0 ? brl(k.deixadoNaMesa) : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
