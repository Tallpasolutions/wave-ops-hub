import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildIqiTrend, iqiTone } from '@/lib/iqi'
import type { IqiSnapshotInput } from '@/lib/iqi'
import { IqiTechChart } from './_components/IqiTechChart'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Meu IQI' }

type SnapshotDbRow = {
  competencia: string
  total_os: number
  contratos_reincidentes: number
  pct_reincidencia: number | string
  synced_at: string
}

export default async function TechnicianIqiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.technicianId || !user.tenantId) redirect('/profile')

  const supabase = await createSupabaseServerClient()

  // Período de produtividade = último mês com visitas deste técnico (RLS já restringe
  // ao próprio técnico; o filtro explícito ajuda o índice).
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
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  const mesLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const [iqiRes, visitsRes] = await Promise.all([
    // RLS: técnico só enxerga os próprios snapshots.
    supabase
      .from('iqi_snapshots')
      .select('competencia, total_os, contratos_reincidentes, pct_reincidencia, synced_at')
      .eq('tenant_id', user.tenantId)
      .eq('tecnico_id', user.technicianId)
      .order('competencia', { ascending: true }),

    supabase
      .from('service_visits')
      .select('os_num, data_execucao, sucesso')
      .eq('tenant_id', user.tenantId)
      .eq('tecnico_id', user.technicianId)
      .eq('fora_escopo', false)
      .gte('data_execucao', start)
      .lt('data_execucao', end),
  ])

  const iqiRows = (iqiRes.data ?? []) as SnapshotDbRow[]
  const visits = (visitsRes.data ?? []) as {
    os_num: number | null
    data_execucao: string | null
    sucesso: string | null
  }[]

  // Produtividade do mês: média de OS por dia ativo + taxa de sucesso.
  const osDistintas = new Set(visits.map((v) => v.os_num).filter((n): n is number => n != null))
  const diasAtivos = new Set(visits.map((v) => v.data_execucao?.slice(0, 10)).filter(Boolean))
  const osPorDia = diasAtivos.size > 0 ? osDistintas.size / diasAtivos.size : 0
  const totalVisitas = visits.length
  const finalizadas = visits.filter((v) => v.sucesso?.trim().toLowerCase().startsWith('sim')).length
  const taxaSucesso = totalVisitas > 0 ? (finalizadas / totalVisitas) * 100 : 0

  // IQI: tendência própria + valor mais recente.
  const inputs: IqiSnapshotInput[] = iqiRows.map((r) => ({
    tecnicoId: user.technicianId!,
    competencia: r.competencia,
    totalOs: r.total_os,
    contratosReincidentes: r.contratos_reincidentes,
    pctReincidencia: Number(r.pct_reincidencia),
  }))
  const trend = buildIqiTrend(inputs)
  const atual = trend.length > 0 ? trend[trend.length - 1] : null
  const anterior = trend.length > 1 ? trend[trend.length - 2] : null
  const tone = atual ? iqiTone(atual.pctReincidencia) : null
  const lastSync = iqiRows.reduce<string | null>(
    (acc, r) => (acc === null || r.synced_at > acc ? r.synced_at : acc),
    null,
  )

  const delta = atual && anterior ? atual.pctReincidencia - anterior.pctReincidencia : null

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-[var(--text-3)]">
          Qualidade de instalação
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[var(--text)]">Meu IQI</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
          Índice de reincidência — quanto menor, melhor
        </p>
      </div>

      {atual === null ? (
        <EmptyState
          variant="card"
          icon={Gauge}
          title="IQI ainda não disponível"
          description="Seu indicador aparecerá aqui assim que a próxima coleta for concluída."
        />
      ) : (
        <>
          {/* IQI atual */}
          <div
            className="mb-4 overflow-hidden rounded-2xl p-5"
            style={{ background: tone!.bg, border: `1px solid ${tone!.fg}33` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: tone!.fg }}>
              IQI de {atual.label}
            </p>
            <p className="mt-2 font-display text-4xl font-bold" style={{ color: tone!.fg }}>
              {atual.pctReincidencia.toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-2)]">
              {atual.contratosReincidentes} de {atual.totalOs} contratos com atendimento reincidente
              {delta !== null && (
                <>
                  {' · '}
                  <span
                    style={{ color: delta <= 0 ? 'var(--green)' : 'var(--red)' }}
                    className="font-semibold"
                  >
                    {delta <= 0 ? '▼' : '▲'} {Math.abs(delta).toFixed(1)} pts vs mês anterior
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Produtividade do mês */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-3 py-3 text-center">
              <p className="font-display text-2xl font-bold text-[var(--text)]">
                {osPorDia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                OS/dia
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-3 py-3 text-center">
              <p className="font-display text-2xl font-bold text-[var(--text)]">{osDistintas.size}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                OSs no mês
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] px-3 py-3 text-center">
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
          </div>

          {/* Tendência */}
          {trend.length > 1 && (
            <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
              <p className="mb-3 font-display text-[14px] font-semibold text-[var(--text)]">
                Sua reincidência por mês
              </p>
              <IqiTechChart data={trend.map((t) => ({ label: t.label, pctReincidencia: t.pctReincidencia }))} />
            </div>
          )}

          {/* Explicação */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4 text-[12px] leading-relaxed text-[var(--text-2)]">
            O <strong className="text-[var(--text)]">IQI</strong> mede o percentual dos seus
            contratos que precisaram de um novo atendimento (reincidência). Um IQI baixo significa
            instalações mais duradouras e menos retrabalho.
            <span className="mt-1 block capitalize text-[var(--text-3)]">
              Produtividade referente a {mesLabel}.
            </span>
          </div>

          {lastSync && (
            <p className="mt-3 text-center text-[11px] text-[var(--text-3)]">
              Atualizado em{' '}
              {new Date(lastSync).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
