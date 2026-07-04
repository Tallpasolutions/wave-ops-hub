import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parsePeriod } from '../_lib/period'
import { getEffectivePeriod } from '../_lib/period-server'
import { aggregate } from './_lib/aggregate'
import type { VisitRow, TechRow, ReasonRow } from './_lib/aggregate'
import { KpiCard } from './_components/KpiCard'
import { OsTypeTable } from './_components/OsTypeTable'
import { TechnicianRankingTable } from './_components/TechnicianRankingTable'
import { GeoDistribution } from './_components/GeoDistribution'
import { ReasonsFailure } from './_components/ReasonsFailure'
import { QualityIndicators } from './_components/QualityIndicators'
import { ExecutiveSummary } from './_components/ExecutiveSummary'
import { DashboardEmpty } from './_components/DashboardEmpty'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = { title: 'Dashboard' }

const VolumeChart = dynamic(() => import('./_components/VolumeChart').then((m) => m.VolumeChart), {
  loading: () => <Skeleton className="h-[280px] w-full" />,
})

const AttendanceDonut = dynamic(() => import('./_components/AttendanceDonut').then((m) => m.AttendanceDonut), {
  loading: () => <Skeleton className="h-[220px] w-full" />,
})

const TechValueChart = dynamic(() => import('./_components/TechValueChart').then((m) => m.TechValueChart), {
  loading: () => <Skeleton className="h-[200px] w-full" />,
})

interface PageProps {
  searchParams: Promise<{ mes?: string }>
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (n: number) =>
  n.toLocaleString('pt-BR')

export default async function DashboardPage({ searchParams }: PageProps) {
  const { mes } = await searchParams

  const user = await getCurrentUser()
  if (!user?.tenantId) return null

  const supabase = await createSupabaseServerClient()

  const mesEfetivo = await getEffectivePeriod(mes, supabase, user.tenantId)
  const { start, end, label: periodLabel } = parsePeriod(mesEfetivo)

  const [visitsRes, techsRes, reasonsRes] = await Promise.all([
    supabase
      .from('service_visits')
      .select(
        'os_num, data_execucao, tecnico_id, tecnico_raw, finalidade, tipo_atendimento, sucesso, improdutiva, rejeitada, valor_recebido_unetvale, cidade, reason_id',
      )
      .eq('tenant_id', user.tenantId)
      .eq('fora_escopo', false)
      .gte('data_execucao', start)
      .lt('data_execucao', end),

    supabase
      .from('technicians')
      .select('id, nome_completo')
      .eq('tenant_id', user.tenantId),

    supabase
      .from('reasons')
      .select('id, motivo_normalizado, categoria')
      .eq('tenant_id', user.tenantId),

  ])

  const visits = (visitsRes.data ?? []) as VisitRow[]
  const techs = (techsRes.data ?? []) as TechRow[]
  const reasons = (reasonsRes.data ?? []) as ReasonRow[]
  // Days in period for media diaria
  const startDate = new Date(start)
  const endDate = new Date(end)
  const daysInPeriod = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const agg = aggregate(visits, techs, reasons, daysInPeriod)
  const { kpis, volumeDiario, porFinalidade, porTipoAtendimento, porTecnico, porCidade, porMotivo } = agg

  const isEmpty = kpis.totalVisitas === 0

  return (
    <div className="p-4 pb-16 lg:p-7">
      {/* ── Header ── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-5">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--cyan)] before:block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--cyan)] before:shadow-[0_0_12px_var(--cyan)]">
            Painel Operacional · Mensal
          </span>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-[var(--text)]">
            Visão Geral
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-2)]">
            Visão consolidada de produtividade, finanças e performance da equipe técnica ·{' '}
            <span className="capitalize">{periodLabel}</span>
          </p>
        </div>
      </div>

      {isEmpty ? (
        <DashboardEmpty periodLabel={periodLabel} />
      ) : (
        <>
          {/* ── KPI Strip ── */}
          <section className="mb-7 grid grid-cols-3 gap-3.5 xl:grid-cols-7">
            <KpiCard
              label="Total de OSs"
              value={fmtNum(kpis.totalOss)}
              valueGradient
              pill={{ text: `${kpis.ossPorDia.toFixed(1)}/dia`, variant: 'cyan' }}
              foot="OSs distintas"
            />
            <KpiCard
              label="Visitas"
              value={fmtNum(kpis.totalVisitas)}
              pill={{ text: `${kpis.mediaDiaria.toFixed(1)}/dia`, variant: 'cyan' }}
              foot="atendimentos"
            />
            <KpiCard
              label="Valor Total Recebido"
              value={fmtBRL(kpis.totalArrecadacao)}
              pill={{
                text: `+${fmtBRL(kpis.arrecadacaoPorDia).replace('R$', 'R$')}/dia`,
                variant: 'green',
              }}
              foot="arrecadação"
            />
            <KpiCard
              label="Ticket Médio por OS"
              value={fmtBRL(kpis.ticketMedio)}
              pill={{ text: 'por OS', variant: 'cyan' }}
              foot="receita ÷ OSs"
            />
            <KpiCard
              label="Taxa de Finalização"
              value={kpis.taxaFinalizacao.toFixed(1)}
              valueSuffix="%"
              pill={{ text: `${fmtNum(kpis.totalFinalizadas)} visitas`, variant: 'green' }}
              foot="com sucesso"
            />
            <KpiCard
              label="Improdutividade"
              value={kpis.improdutividade.toFixed(1)}
              valueSuffix="%"
              pill={{ text: `${fmtNum(kpis.totalImprodutivas)} visitas`, variant: 'amber' }}
              foot="sem produção"
            />
            <KpiCard
              label="Equipe Ativa"
              value={String(kpis.equipeAtiva)}
              pill={{ text: `${kpis.cidadesAtendidas} cidades`, variant: 'cyan' }}
              foot="atendidas"
            />
          </section>

          {/* ── Volume Diário ── */}
          <section className="mb-3.5">
            <Card
              title="Volume Diário e Arrecadação"
              sub={`Operação consolidada · ${periodLabel}`}
              tag={`${daysInPeriod} dias`}
            >
              <VolumeChart data={volumeDiario} />
            </Card>
          </section>

          {/* ── Tipos de OS + Tipo Atendimento ── */}
          <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
            <Card
              title="Tipos de Ordem de Serviço"
              sub="Volume, ticket médio e taxa de finalização"
              tag={`${porFinalidade.length} categorias`}
            >
              <OsTypeTable rows={porFinalidade} totalVisitas={kpis.totalVisitas} />
            </Card>
            <Card title="Tipo de Atendimento" sub="Externo vs Interno">
              <AttendanceDonut data={porTipoAtendimento} total={kpis.totalVisitas} />
            </Card>
          </section>

          {/* ── Ranking de Técnicos ── */}
          {porTecnico.length > 0 && (
            <section className="mb-3.5">
              <Card
                title="Ranking de Técnicos · Performance Operacional"
                sub="Volume executado, valor gerado e taxa de sucesso"
                tag={`${porTecnico.length} técnicos`}
              >
                <TechnicianRankingTable rows={porTecnico} />
              </Card>
            </section>
          )}

          {/* ── Top por Valor + Não Finalizadas ── */}
          <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <Card title="Top Técnicos por Valor Gerado" sub="Receita arrecadada no período">
              <TechValueChart data={porTecnico} />
            </Card>
            <Card
              title="Atenção · OSs Não Finalizadas"
              sub="Ranking por volume de não-conclusão"
              tagVariant="red"
              tag={`${kpis.totalVisitas - kpis.totalFinalizadas} totais`}
            >
              <NaoFinalizadasList rows={porTecnico} />
            </Card>
          </section>

          {/* ── Cidades + Motivos ── */}
          <section className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
            <Card
              title="Distribuição Geográfica"
              sub="Volume e arrecadação por cidade"
              tag={`${porCidade.length} cidades`}
            >
              <GeoDistribution rows={porCidade} />
            </Card>
            <Card title="Motivos de Não-Conclusão" sub="Top causas operacionais">
              {porMotivo.length > 0 ? (
                <ReasonsFailure rows={porMotivo} />
              ) : (
                <p className="py-6 text-center text-sm text-[var(--text-3)]">
                  Nenhum motivo registrado no período.
                </p>
              )}
            </Card>
          </section>

          {/* ── Indicadores de Qualidade + Resumo Executivo ── */}
          <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            <Card title="Indicadores de Qualidade" sub="Saúde operacional do mês">
              <QualityIndicators kpis={kpis} />
            </Card>
            <div className="lg:col-span-2">
              <div
                className="h-full rounded-2xl border p-[22px]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(30,107,255,0.04))',
                  borderColor: 'rgba(0,212,255,0.18)',
                }}
              >
                <div className="mb-4">
                  <p className="font-display text-[15px] font-semibold tracking-tight text-[var(--cyan)]">
                    Resumo Executivo
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[1px] text-[var(--text-3)]">
                    Highlights de {periodLabel}
                  </p>
                </div>
                <ExecutiveSummary agg={agg} periodLabel={periodLabel} />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ── Local helpers ──────────────────────────────────────────────────────────────

function Card({
  title,
  sub,
  tag,
  tagVariant = 'cyan',
  children,
}: {
  title: string
  sub?: string
  tag?: string
  tagVariant?: 'cyan' | 'red'
  children: React.ReactNode
}) {
  const tagStyle =
    tagVariant === 'red'
      ? { background: 'rgba(255,84,112,0.10)', borderColor: 'rgba(255,84,112,0.20)', color: 'var(--red)' }
      : undefined

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[rgba(10,15,34,0.4)] p-[22px]">
      <div className="mb-[18px] flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[15px] font-semibold tracking-tight text-[var(--text)]">
            {title}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] uppercase tracking-[1px] text-[var(--text-3)]">{sub}</p>
          )}
        </div>
        {tag && (
          <span
            className="shrink-0 rounded-full border border-[rgba(0,212,255,0.2)] bg-[var(--grad-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-[var(--cyan)]"
            style={tagStyle}
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function NaoFinalizadasList({ rows }: { rows: ReturnType<typeof aggregate>['porTecnico'] }) {
  const sorted = [...rows].sort((a, b) => b.naoFinalizadas - a.naoFinalizadas).slice(0, 6)
  const max = Math.max(...sorted.map((r) => r.naoFinalizadas), 1)

  return (
    <div className="divide-y divide-[var(--line)]">
      {sorted.map((row) => (
        <div key={row.id ?? row.nome} className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <p className="text-[13px] font-semibold">{row.nome}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.naoFinalizadas / max) * 100}%`,
                  background: 'linear-gradient(90deg, #FF5470, #FF8A47)',
                }}
              />
            </div>
          </div>
          <span className="font-mono text-[13px] font-bold text-[var(--red)]">
            {row.naoFinalizadas}
          </span>
        </div>
      ))}
    </div>
  )
}
