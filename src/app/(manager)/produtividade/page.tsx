import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Gauge } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildIqiTrend, iqiByTecnico, teamIqi, iqiTone } from '@/lib/iqi'
import type { IqiSnapshotInput } from '@/lib/iqi'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { parsePeriod } from '../_lib/period'
import { getEffectivePeriod } from '../_lib/period-server'
import { aggregate } from '../dashboard/_lib/aggregate'
import type { VisitRow, TechRow, ReasonRow } from '../dashboard/_lib/aggregate'
import { KpiCard } from '../dashboard/_components/KpiCard'
import { SyncIqiButton } from './_components/SyncIqiButton'
import { ProdutividadeTable } from './_components/ProdutividadeTable'
import type { ProdutividadeRow } from './_components/ProdutividadeTable'

export const metadata: Metadata = { title: 'Produtividade' }

const IqiTrendChart = dynamic(
  () => import('./_components/IqiTrendChart').then((m) => m.IqiTrendChart),
  { loading: () => <Skeleton className="h-[280px] w-full" /> },
)

interface PageProps {
  searchParams: Promise<{ mes?: string }>
}

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

// Linha crua do snapshot lida do banco.
type SnapshotDbRow = {
  tecnico_id: string
  competencia: string
  total_os: number
  contratos_reincidentes: number
  pct_reincidencia: number | string
  synced_at: string
}

export default async function ProdutividadePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const user = await getCurrentUser()
  if (!user?.tenantId) return null

  const supabase = await createSupabaseServerClient()
  const mesEfetivo = await getEffectivePeriod(sp.mes, supabase, user.tenantId)
  const { start, end, label: periodLabel } = parsePeriod(mesEfetivo)

  const [visitsRes, techsRes, reasonsRes, iqiRes] = await Promise.all([
    supabase
      .from('service_visits')
      .select(
        'os_num, data_execucao, tecnico_id, tecnico_raw, finalidade, tipo_atendimento, sucesso, improdutiva, rejeitada, valor_recebido_unetvale, cidade, reason_id',
      )
      .eq('tenant_id', user.tenantId)
      .eq('fora_escopo', false)
      .gte('data_execucao', start)
      .lt('data_execucao', end),

    supabase.from('technicians').select('id, nome_completo').eq('tenant_id', user.tenantId),

    supabase
      .from('reasons')
      .select('id, motivo_normalizado, categoria')
      .eq('tenant_id', user.tenantId),

    supabase
      .from('iqi_snapshots')
      .select('tecnico_id, competencia, total_os, contratos_reincidentes, pct_reincidencia, synced_at')
      .eq('tenant_id', user.tenantId),
  ])

  const visits = (visitsRes.data ?? []) as VisitRow[]
  const techs = (techsRes.data ?? []) as TechRow[]
  const reasons = (reasonsRes.data ?? []) as ReasonRow[]
  const iqiRows = (iqiRes.data ?? []) as SnapshotDbRow[]

  const startDate = new Date(start)
  const endDate = new Date(end)
  const daysInPeriod = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const { kpis, porTecnico } = aggregate(visits, techs, reasons, daysInPeriod, start)

  // IQI: normaliza para camelCase e deriva tendência + recorte da competência atual.
  const iqiInputs: IqiSnapshotInput[] = iqiRows.map((r) => ({
    tecnicoId: r.tecnico_id,
    competencia: r.competencia,
    totalOs: r.total_os,
    contratosReincidentes: r.contratos_reincidentes,
    pctReincidencia: Number(r.pct_reincidencia),
  }))
  const trend = buildIqiTrend(iqiInputs)
  const iqiDoMes = iqiByTecnico(iqiInputs, mesEfetivo)
  const equipe = teamIqi(iqiInputs, mesEfetivo)
  const lastSync = iqiRows.reduce<string | null>(
    (acc, r) => (acc === null || r.synced_at > acc ? r.synced_at : acc),
    null,
  )

  const semVisitas = kpis.totalVisitas === 0
  const semIqi = iqiInputs.length === 0

  const rows: ProdutividadeRow[] = porTecnico.map((t) => ({
    id: t.id,
    nome: t.nome,
    totalOs: t.totalOs,
    ossPorDia: daysInPeriod > 0 ? t.totalOs / daysInPeriod : 0,
    taxaSucesso: t.taxaSucesso,
    improdutivas: t.improdutivas,
    iqiPct: t.id ? (iqiDoMes.get(t.id)?.pctReincidencia ?? null) : null,
  }))

  const equipeTone = equipe ? iqiTone(equipe.pctReincidencia) : null

  return (
    <div className="p-4 pb-16 lg:p-7">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] pb-5">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--cyan)] before:block before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--cyan)] before:shadow-[0_0_12px_var(--cyan)]">
            Gestão de Equipes · Qualidade
          </span>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-[var(--text)]">
            Produtividade &amp; IQI
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-2)]">
            Produtividade da equipe cruzada com o IQI (reincidência) da Unetvale ·{' '}
            <span className="capitalize">{periodLabel}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <SyncIqiButton />
          {lastSync && (
            <span className="text-[11px] text-[var(--text-3)]">
              IQI sincronizado em{' '}
              {new Date(lastSync).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {semVisitas && semIqi ? (
        <EmptyState
          variant="card"
          icon={Gauge}
          title="Sem dados no período"
          description={`Nenhuma visita ou IQI para ${periodLabel}. Faça upload da planilha do mês e sincronize o IQI.`}
        />
      ) : (
        <>
          {/* ── KPIs ── */}
          <section className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="relative overflow-hidden rounded-[14px] border border-[var(--line)] bg-gradient-to-b from-[var(--bg-1)] to-[rgba(13,21,48,0.6)] px-[18px] py-5">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-grad opacity-70" />
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1.4px] text-[var(--text-3)]">
                IQI da Equipe
              </p>
              {equipe ? (
                <>
                  <p
                    className="font-display text-[clamp(20px,2.2vw,28px)] font-bold leading-none tracking-[-1px] tabular-nums"
                    style={{ color: equipeTone!.fg }}
                  >
                    {equipe.pctReincidencia.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    <span className="font-body text-lg font-normal text-[var(--text-2)]">%</span>
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                      style={{ background: equipeTone!.bg, color: equipeTone!.fg }}
                    >
                      {equipeTone!.label}
                    </span>
                    <span>reincidência</span>
                  </div>
                </>
              ) : (
                <p className="font-display text-2xl font-bold text-[var(--text-3)]">—</p>
              )}
            </div>

            <KpiCard
              label="Total de OSs"
              value={fmtNum(kpis.totalOss)}
              valueGradient
              pill={{ text: `${kpis.ossPorDia.toFixed(1)}/dia`, variant: 'cyan' }}
              foot="no período"
            />
            <KpiCard
              label="Taxa de Sucesso"
              value={kpis.taxaFinalizacao.toFixed(1)}
              valueSuffix="%"
              pill={{ text: `${fmtNum(kpis.totalFinalizadas)} visitas`, variant: 'green' }}
              foot="finalizadas"
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
              foot="técnicos"
            />
          </section>

          {/* ── Tendência do IQI ── */}
          <section className="mb-3.5">
            <Card
              title="Tendência do IQI · Reincidência mensal"
              sub="Barras = volume de OSs · linha = % de contratos com atendimento reincidente"
              tag={trend.length > 0 ? `${trend.length} meses` : undefined}
            >
              {trend.length > 0 ? (
                <IqiTrendChart data={trend} />
              ) : (
                <p className="py-10 text-center text-sm text-[var(--text-3)]">
                  Nenhum IQI coletado ainda. Use &quot;Sincronizar IQI&quot; ou aguarde a coleta automática.
                </p>
              )}
            </Card>
          </section>

          {/* ── Tabela por técnico ── */}
          <section>
            <Card
              title="Produtividade por Técnico"
              sub={`Volume, sucesso e IQI · ${periodLabel} · ordenado pelo pior IQI`}
              tag={`${rows.length} técnicos`}
            >
              {rows.length > 0 ? (
                <ProdutividadeTable rows={rows} />
              ) : (
                <p className="py-6 text-center text-sm text-[var(--text-3)]">
                  Nenhuma visita no período.
                </p>
              )}
            </Card>
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
  children,
}: {
  title: string
  sub?: string
  tag?: string
  children: React.ReactNode
}) {
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
          <span className="shrink-0 rounded-full border border-[rgba(0,212,255,0.2)] bg-[var(--grad-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-[var(--cyan)]">
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
