import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { PAID_STATUSES, payoutValor } from './_lib/points'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Início' }

const fmtPts = (n: number) =>
  `${Math.round(n).toLocaleString('pt-BR')} pts`

// Bounds do mês "YYYY-MM" → [start, end) em datas "YYYY-MM-DD".
function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { start, end, label }
}

// Ranking anônimo: o RLS impede o técnico de ver payouts de outros, então a posição é
// calculada no servidor com o admin client (retorna só posição + total, no mesmo período).
async function computeRank(
  tenantId: string,
  technicianId: string,
  start: string,
  end: string,
): Promise<{ rankPos: number; totalTechs: number }> {
  const admin = createSupabaseAdminClient()
  const { rows } = await fetchAllPages<{
    technician_id: string | null
    valor_calculado: number | null
    valor_override: number | null
  }>((from, to) =>
    admin
      .from('payouts')
      .select('technician_id, valor_calculado, valor_override, service_visits!inner(data_execucao)')
      .eq('tenant_id', tenantId)
      .not('technician_id', 'is', null)
      .in('status', PAID_STATUSES)
      .gte('service_visits.data_execucao', start)
      .lt('service_visits.data_execucao', end)
      .order('id')
      .range(from, to),
  )
  const rankMap = new Map<string, number>()
  for (const p of rows) {
    if (!p.technician_id) continue
    rankMap.set(p.technician_id, (rankMap.get(p.technician_id) ?? 0) + payoutValor(p))
  }
  const sorted = [...rankMap.entries()].sort((a, b) => b[1] - a[1])
  return { rankPos: sorted.findIndex(([id]) => id === technicianId) + 1, totalTechs: sorted.length }
}

export default async function TechnicianHomePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.technicianId || !user.tenantId) redirect('/profile')

  const supabase = await createSupabaseServerClient()

  // Período = último mês com visitas DESTE técnico (não o mês corrente vazio). Antes a home
  // abria em julho vazio (0 visitas) e somava payouts de TODOS os meses — os pontos não batiam
  // com o "A pagar" do gestor.
  const { data: ultimaVisita } = await supabase
    .from('service_visits')
    .select('data_execucao')
    .eq('tenant_id', user.tenantId)
    .eq('tecnico_id', user.technicianId)
    .eq('fora_escopo', false)
    .order('data_execucao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ym = (ultimaVisita?.data_execucao ?? new Date().toISOString()).slice(0, 7)
  const { start, end, label: mesLabel } = monthBounds(ym)

  const [tenantRes, visitsRes, myPayoutsRes] = await Promise.all([
    supabase.from('tenants').select('config').eq('id', user.tenantId).single(),

    supabase
      .from('service_visits')
      .select('id, sucesso, improdutiva, valor_recebido_unetvale, finalidade, reason_id')
      .eq('tenant_id', user.tenantId)
      .eq('tecnico_id', user.technicianId)
      .eq('fora_escopo', false)
      .gte('data_execucao', start)
      .lt('data_execucao', end),

    // Payouts DESTE técnico no período (join pela data da visita) — mesma base do "A pagar"
    // do gestor. RLS já restringe ao próprio técnico.
    supabase
      .from('payouts')
      .select(
        'status, valor_calculado, valor_override, valor_deixado_na_mesa, service_visits!inner(data_execucao)',
      )
      .eq('tenant_id', user.tenantId)
      .eq('technician_id', user.technicianId)
      .gte('service_visits.data_execucao', start)
      .lt('service_visits.data_execucao', end),
  ])

  const tenantConfig = (tenantRes.data?.config ?? {}) as Record<string, unknown>
  const showMoney = tenantConfig.show_money_on_technician_panel !== false

  const visits = visitsRes.data ?? []
  const myPayouts = (myPayoutsRes.data ?? []) as {
    status: string
    valor_calculado: number | null
    valor_override: number | null
    valor_deixado_na_mesa: number | null
  }[]

  const totalVisitas = visits.length
  const finalizadas = visits.filter((v) => (v.sucesso as string)?.toLowerCase().startsWith('s')).length
  const taxaSucesso = totalVisitas > 0 ? (finalizadas / totalVisitas) * 100 : 0

  // Pontos = "A pagar" do período (mesma fórmula/status do painel do gestor).
  const aReceber = myPayouts
    .filter((p) => PAID_STATUSES.includes(p.status))
    .reduce((acc, p) => acc + payoutValor(p), 0)
  const pendentesCount = myPayouts.filter((p) =>
    ['pending', 'pending_review'].includes(p.status),
  ).length

  const deixadoNaMesa = myPayouts.reduce(
    (acc, p) => acc + Number(p.valor_deixado_na_mesa ?? 0),
    0,
  )

  const { rankPos, totalTechs } = await computeRank(
    user.tenantId,
    user.technicianId,
    start,
    end,
  )

  // Insights
  const topFinalidade = (() => {
    const m = new Map<string, number>()
    for (const v of visits) {
      const f = (v.finalidade as string) ?? 'Sem categoria'
      m.set(f, (m.get(f) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]
  })()

  const motivoFreq = (() => {
    if (!visits.some((v) => !(v.sucesso as string)?.toLowerCase().startsWith('s'))) return null
    const m = new Map<string, number>()
    for (const v of visits) {
      if ((v.sucesso as string)?.toLowerCase().startsWith('s')) continue
      const rid = v.reason_id as string | null
      if (!rid) continue
      m.set(rid, (m.get(rid) ?? 0) + 1)
    }
    return m.size > 0 ? [...m.entries()].sort((a, b) => b[1] - a[1])[0] : null
  })()

  const primeiroNome = user.nomeCompleto.split(' ')[0]

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {/* Saudação */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-3)]">
          Bem-vindo de volta
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[var(--text)]">{primeiroNome}</h1>
        <p className="mt-0.5 text-[13px] capitalize text-[var(--text-2)]">{mesLabel}</p>
      </div>

      {/* Card "A receber" */}
      {showMoney && (
        <div
          className="mb-4 overflow-hidden rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(30,107,255,0.10) 100%)',
            border: '1px solid rgba(0,212,255,0.20)',
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[var(--cyan)]">
            Seus pontos este mês
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-[var(--text)]">
            {fmtPts(aReceber)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            {pendentesCount} pontuação{pendentesCount !== 1 ? 's' : ''} pendente
            {pendentesCount !== 1 ? 's' : ''} de aprovação
          </p>
        </div>
      )}

      {/* Deixado na mesa — condicional */}
      {showMoney && deixadoNaMesa > 0 && (
        <div
          className="mb-4 flex items-center justify-between rounded-xl border p-4"
          style={{
            background: 'rgba(255,84,112,0.05)',
            borderColor: 'rgba(255,84,112,0.18)',
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-[var(--red)]" />
            <div>
              <p className="text-[12px] font-semibold text-[var(--text)]">Deixado na mesa</p>
              <p className="text-[11px] text-[var(--text-3)]">Valor potencial não recebido</p>
            </div>
          </div>
          <span className="font-mono text-[14px] font-bold text-[var(--red)]">
            {fmtPts(deixadoNaMesa)}
          </span>
        </div>
      )}

      {/* Grid de KPIs */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-center">
          <p className="font-display text-2xl font-bold text-[var(--text)]">{totalVisitas}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Visitas
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-center">
          <p
            className={`font-display text-2xl font-bold ${
              taxaSucesso >= 70
                ? 'text-[var(--green)]'
                : taxaSucesso >= 55
                  ? 'text-[var(--cyan)]'
                  : 'text-[var(--amber)]'
            }`}
          >
            {taxaSucesso.toFixed(0)}%
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Sucesso
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 text-center">
          {rankPos > 0 && totalTechs > 0 ? (
            <>
              <p className="font-display text-2xl font-bold text-[var(--text)]">
                {rankPos}º
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                de {totalTechs}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold text-[var(--text-3)]">—</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Rank
              </p>
            </>
          )}
        </div>
      </div>

      {/* Insights */}
      {totalVisitas > 0 && (
        <div className="mb-4 space-y-2">
          {topFinalidade && (
            <div
              className="flex items-start gap-3 rounded-xl border p-3.5 text-[12px] leading-relaxed"
              style={{
                background: 'linear-gradient(135deg, rgba(46,230,168,0.06), rgba(46,230,168,0.02))',
                borderColor: 'rgba(46,230,168,0.15)',
              }}
            >
              <TrendingUp size={15} className="mt-0.5 shrink-0 text-[var(--green)]" />
              <span className="text-[var(--text-2)]">
                Sua principal fonte:{' '}
                <strong className="text-[var(--text)]">{topFinalidade[0]}</strong> (
                {topFinalidade[1]} visitas)
              </span>
            </div>
          )}
          {motivoFreq && (
            <div
              className="flex items-start gap-3 rounded-xl border p-3.5 text-[12px] leading-relaxed"
              style={{
                background: 'rgba(255,181,71,0.05)',
                borderColor: 'rgba(255,181,71,0.15)',
              }}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--amber)]" />
              <span className="text-[var(--text-2)]">
                Motivo mais frequente de não-conclusão registrado no período.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {totalVisitas === 0 && (
        <EmptyState
          variant="card"
          icon={ClipboardList}
          title="Nenhuma visita ainda"
          description="Suas visitas deste mês aparecerão aqui. Continue assim!"
        />
      )}

      {/* Quick actions */}
      <div className="mt-2 space-y-2">
        <Link
          href="/visitas"
          className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3.5 transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            <ClipboardList size={16} className="text-[var(--cyan)]" />
            <span className="text-[13px] font-medium text-[var(--text)]">Ver minhas visitas</span>
          </div>
          <ChevronRight size={15} className="text-[var(--text-3)]" />
        </Link>
        <Link
          href="/historico"
          className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3.5 transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            <TrendingUp size={16} className="text-[var(--cyan)]" />
            <span className="text-[13px] font-medium text-[var(--text)]">Histórico de meses</span>
          </div>
          <ChevronRight size={15} className="text-[var(--text-3)]" />
        </Link>
      </div>
    </div>
  )
}
