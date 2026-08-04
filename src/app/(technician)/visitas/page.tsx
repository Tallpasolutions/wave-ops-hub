import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Minhas Visitas' }
import { parsePeriod, buildPeriodOptions } from '../_lib/period'
import { PeriodSelector } from '../_components/PeriodSelector'
import { ContestarOs, type Contestacao } from './_components/ContestarOs'
import { OsSearchInput } from '../_components/OsSearchInput'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { Suspense } from 'react'

// Payouts nestes estados são finais/fechados — não dá pra contestar.
const NAO_CONTESTAVEL = new Set(['approved', 'paid'])

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ mes?: string; os?: string }>
}

const fmtPts = (n: number) =>
  `${Math.round(n).toLocaleString('pt-BR')} pts`
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

type Payout = {
  id: string
  visit_id: string
  valor_calculado: number | null
  valor_override: number | null
  valor_deixado_na_mesa: number | null
  acrescimo_dom_feriado: number | null
  status: string | null
}

export default async function VisitasPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.technicianId || !user.tenantId) redirect('/profile')

  const { mes, os } = await searchParams
  const { start, end, label: periodLabel } = parsePeriod(mes)
  const periodOptions = buildPeriodOptions()
  const currentMes = mes ?? periodOptions[0].value
  const busca = (os ?? '').trim()
  const buscando = busca.length > 0

  const supabase = await createSupabaseServerClient()

  const VISIT_COLS =
    'id, os_num, data_execucao, finalidade, sucesso, improdutiva, valor_recebido_unetvale, reason_id'

  // Buscando por OS, a varredura ignora o mês: quem procura pelo número raramente lembra em que
  // competência a OS caiu. Sem busca, mantém o recorte do período selecionado.
  const [visitsRes, reasonsRes] = await Promise.all([
    buscando
      ? fetchAllPages<Record<string, unknown>>((from, to) =>
          supabase
            .from('service_visits')
            .select(VISIT_COLS)
            .eq('tenant_id', user.tenantId!)
            .eq('tecnico_id', user.technicianId!)
            .order('data_execucao', { ascending: false })
            .range(from, to),
        ).then(({ rows, error }) => ({ data: rows, error }))
      : supabase
          .from('service_visits')
          .select(VISIT_COLS)
          .eq('tenant_id', user.tenantId)
          .eq('tecnico_id', user.technicianId)
          .gte('data_execucao', start)
          .lt('data_execucao', end)
          .order('data_execucao', { ascending: false }),

    supabase
      .from('reasons')
      .select('id, motivo_normalizado')
      .eq('tenant_id', user.tenantId),
  ])

  // Filtro por trecho do número (não só igualdade): o técnico costuma lembrar os últimos dígitos.
  const todasAsVisitas = visitsRes.data ?? []
  const visits = buscando
    ? todasAsVisitas.filter((v) => String(v.os_num).includes(busca))
    : todasAsVisitas
  const reasons = reasonsRes.data ?? []

  const reasonMap = new Map(reasons.map((r) => [r.id as string, r.motivo_normalizado as string]))

  // ADR-021: OSs em que a Unetvale mudou o valor depois. Só interessa ao técnico quando os
  // PONTOS dele mudaram — receita da Unetvale ele não vê. A RLS já limita ao próprio técnico.
  const visitIds = visits.map((v) => v.id as string)
  const alteradasComMudancaDePontos = new Set<string>()
  if (visitIds.length > 0) {
    const { data: alts } = await supabase
      .from('unetvale_alteracoes')
      .select('visit_id, payout_anterior, payout_novo')
      .in('visit_id', visitIds)
    for (const a of alts ?? []) {
      // `payout_novo` nulo = não avaliado (registro retroativo do backfill da 0041), não "virou
      // nada". Avisar o técnico nesse caso é alarme falso — o pagamento dele ficou igual.
      if (a.payout_novo === null) continue
      const antes = a.payout_anterior === null ? null : Math.round(Number(a.payout_anterior) * 100)
      const depois = Math.round(Number(a.payout_novo) * 100)
      if (antes !== depois) alteradasComMudancaDePontos.add(a.visit_id as string)
    }
  }

  // Payouts para as visitas do período
  let payouts: Payout[] = []
  if (visitIds.length > 0) {
    const { data } = await supabase
      .from('payouts')
      .select('id, visit_id, valor_calculado, valor_override, valor_deixado_na_mesa, acrescimo_dom_feriado, status')
      .in('visit_id', visitIds)
    payouts = (data ?? []) as Payout[]
  }
  const payoutMap = new Map(payouts.map((p) => [p.visit_id, p]))

  // Contestações do técnico para os payouts do período (contestação contínua — ADR-013).
  const payoutIds = payouts.map((p) => p.id)
  const contestacaoByPayout = new Map<string, Contestacao>()
  if (payoutIds.length > 0) {
    const { data: contestacoes } = await supabase
      .from('payout_contestacoes')
      .select('payout_id, status, motivo, resposta_gestor, valor_anterior, valor_novo')
      .eq('tenant_id', user.tenantId)
      .eq('technician_id', user.technicianId)
      .in('payout_id', payoutIds)
    const toNum = (v: unknown) => (v == null ? null : Number(v))
    for (const c of contestacoes ?? []) {
      contestacaoByPayout.set(c.payout_id as string, {
        status: c.status as 'aberta' | 'resolvida',
        motivo: c.motivo as string,
        resposta: (c.resposta_gestor as string | null) ?? null,
        valorAnterior: toNum(c.valor_anterior),
        valorNovo: toNum(c.valor_novo),
      })
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-[var(--text)]">Minhas Visitas</h1>
          <p className="mt-0.5 text-[12px] capitalize text-[var(--text-2)]">
            {buscando ? `Busca por "${busca}" · todos os meses` : periodLabel}
          </p>
        </div>
        {/* Durante a busca o seletor de mês sai: a varredura é de todo o histórico, e deixá-lo
            à vista sugeriria um recorte que não está sendo aplicado. */}
        {!buscando && (
          <Suspense>
            <PeriodSelector options={periodOptions} selected={currentMes} />
          </Suspense>
        )}
      </div>

      <div className="mb-5">
        <Suspense>
          <OsSearchInput initial={busca} />
        </Suspense>
        {buscando && (
          <p className="mt-2 text-[11px] text-[var(--text-3)]">
            {visits.length === 0
              ? 'Nenhuma OS encontrada com esse número.'
              : `${visits.length} ${visits.length === 1 ? 'visita encontrada' : 'visitas encontradas'} em todo o seu histórico.`}
          </p>
        )}
      </div>

      {visits.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Clock}
          title={buscando ? `Nada encontrado para "${busca}"` : `Nenhuma visita em ${periodLabel}`}
          description={
            buscando
              ? 'Confira o número da OS. A busca procura em todas as suas visitas, de qualquer mês.'
              : 'Suas execuções do período aparecerão aqui.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visits.map((v) => {
            const sucesso = (v.sucesso as string)?.toLowerCase().startsWith('s')
            const improdutiva = v.improdutiva as boolean
            const payout = payoutMap.get(v.id as string)
            const valorPayout =
              payout?.valor_override ?? payout?.valor_calculado ?? null
            const deixadoNaMesa = payout?.valor_deixado_na_mesa ?? 0
            // ADR-011: acréscimo de domingo/feriado embutido no valor calculado. Só sinaliza
            // quando não há override (o override substitui o valor calculado).
            const acrescimoDomFeriado =
              payout?.valor_override == null && payout?.acrescimo_dom_feriado != null
                ? Number(payout.acrescimo_dom_feriado)
                : 0

            // Cor da borda
            let borderColor = 'border-[var(--line)]'
            if (sucesso) borderColor = 'border-l-[var(--green)] border-l-2'
            else if (improdutiva && payout?.status === 'approved')
              borderColor = 'border-l-[var(--amber)] border-l-2'
            else if (!sucesso) borderColor = 'border-l-[var(--red)] border-l-2'

            const motivo = v.reason_id ? reasonMap.get(v.reason_id as string) : null

            // ADR-020: visita concluída que não gerou receita para a Unetvale não tem repasse
            // automático. Sem essa linha o técnico vê "0 pts" numa visita finalizada sem
            // nenhuma explicação — e o caminho previsto é justamente contestar.
            const semRepassePorReceitaZerada =
              sucesso &&
              valorPayout === 0 &&
              v.valor_recebido_unetvale !== null &&
              Number(v.valor_recebido_unetvale) === 0

            return (
              <div
                key={v.id as string}
                className={`rounded-xl border bg-[var(--bg-1)] p-4 ${borderColor}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] text-[var(--text-3)]">
                      OS #{v.os_num}
                    </span>
                    <p className="mt-0.5 text-[13px] font-semibold text-[var(--text)]">
                      {(v.finalidade as string) ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sucesso ? (
                      <CheckCircle2 size={16} className="text-[var(--green)]" />
                    ) : (
                      <XCircle size={16} className="text-[var(--red)]" />
                    )}
                    <span
                      className={`text-[11px] font-semibold ${
                        sucesso ? 'text-[var(--green)]' : 'text-[var(--red)]'
                      }`}
                    >
                      {sucesso ? 'Finalizada' : improdutiva ? 'Improdutiva' : 'Não concluída'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-3)]">
                    {fmtDate(v.data_execucao as string)}
                  </span>
                  <div className="text-right">
                    {valorPayout !== null && (
                      <span
                        className={`font-mono text-[13px] font-bold ${
                          sucesso ? 'text-[var(--green)]' : 'text-[var(--text-2)]'
                        }`}
                      >
                        {fmtPts(valorPayout)}
                      </span>
                    )}
                    {acrescimoDomFeriado > 0 && (
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--cyan)]">
                        inclui +{fmtPts(acrescimoDomFeriado)} domingo/feriado
                      </p>
                    )}
                    {deixadoNaMesa > 0 && (
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--red)]">
                        -{fmtPts(deixadoNaMesa)} na mesa
                      </p>
                    )}
                  </div>
                </div>

                {motivo && (
                  <p className="mt-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-[var(--text-3)]">
                    {motivo}
                  </p>
                )}

                {alteradasComMudancaDePontos.has(v.id as string) && (
                  <p
                    className="mt-2 rounded-md px-2.5 py-1.5 text-[11px]"
                    style={{ background: 'rgba(255,181,71,0.06)', color: 'var(--text-2)' }}
                  >
                    A Unetvale alterou o valor desta OS depois do serviço, e seus pontos mudaram.
                    Se você não concorda, conteste aqui embaixo.
                  </p>
                )}

                {semRepassePorReceitaZerada && (
                  <p className="mt-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-[var(--text-3)]">
                    Esta OS veio sem valor pela Unetvale, por isso não gerou pontos. Se você
                    entende que deveria receber, conteste aqui embaixo.
                  </p>
                )}

                {payout && !NAO_CONTESTAVEL.has(payout.status ?? '') && (
                  <ContestarOs
                    payoutId={payout.id}
                    periodo={(v.data_execucao as string).slice(0, 7)}
                    contestacao={contestacaoByPayout.get(payout.id) ?? null}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
