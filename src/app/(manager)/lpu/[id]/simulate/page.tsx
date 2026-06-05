import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { simulate } from '@/lib/lpu'
import type { LpuRuleNarrowed, ReasonForPayout, SimVisit } from '@/lib/lpu'
import { activateLpu } from '../../actions'
import { parsePeriod, buildPeriodOptions } from '../../../_lib/period'

// ── Helpers de display ────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CountCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        {label}
      </p>
      <p
        className={`font-display text-3xl font-bold ${
          highlight && value > 0 ? 'text-[var(--red)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function MoneyCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'green' | 'default'
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)]">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-bold ${
          variant === 'green' ? 'text-[var(--green)]' : 'text-[var(--text)]'
        }`}
      >
        {formatBRL(value)}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
}

export default async function SimulatePage({ params, searchParams }: Props) {
  const { id } = await params
  const { mes } = await searchParams

  const { start: inicio, end: fimExclusivo, label: periodoLabel } = parsePeriod(mes)
  const mesAtual = mes ?? inicio.slice(0, 7)
  const meses = buildPeriodOptions()

  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [
    { data: lpu },
    { data: rulesRaw },
    { data: visitsRaw },
    { data: reasonsRaw },
    { data: tecnicos },
  ] = await Promise.all([
    supabase.from('lpus').select('*').eq('id', id).single(),
    supabase.from('lpu_rules').select('*').eq('lpu_id', id).eq('ativa', true),
    supabase
      .from('service_visits')
      .select(
        'id, os_num, tecnico_id, reason_id, finalidade, tipo_atendimento, sucesso, cidade, condominio, drop_usado, faixa_drop, conectores_usados, garantia, subterraneo_aereo, valor_recebido_unetvale',
      )
      .eq('tenant_id', user.tenantId!)
      .gte('data_execucao', inicio)
      .lt('data_execucao', fimExclusivo),
    supabase
      .from('reasons')
      .select('id, categoria, paga_improdutiva, valor_improdutiva')
      .eq('tenant_id', user.tenantId!),
    supabase.from('technicians').select('id, nome').eq('tenant_id', user.tenantId!),
  ])

  if (!lpu) notFound()

  const rules = (rulesRaw ?? []) as LpuRuleNarrowed[]
  const tecnicoNomes = new Map((tecnicos ?? []).map((t) => [t.id, t.nome]))

  const simVisits: SimVisit[] = (visitsRaw ?? []).map((v) => ({
    id: v.id,
    osNum: Number(v.os_num),
    tecnicoId: v.tecnico_id,
    reasonId: v.reason_id,
    finalidade: v.finalidade,
    tipoAtendimento: v.tipo_atendimento as 'Externo' | 'Interno' | null,
    sucesso: v.sucesso ?? '',
    cidade: v.cidade ?? '',
    condominio: v.condominio ?? false,
    dropUsado: v.drop_usado != null ? Number(v.drop_usado) : null,
    faixaDrop: v.faixa_drop,
    conectoresUsados: v.conectores_usados,
    garantia: v.garantia ?? false,
    subterraneaAereo: v.subterraneo_aereo,
    valorRecebidoUnetvale:
      v.valor_recebido_unetvale != null ? Number(v.valor_recebido_unetvale) : null,
  }))

  const reasons: ReasonForPayout[] = (reasonsRaw ?? []).map((r) => ({
    id: r.id,
    categoria: r.categoria,
    pagaImprodutiva: r.paga_improdutiva,
    valorImprodutiva: r.valor_improdutiva != null ? Number(r.valor_improdutiva) : null,
  }))

  const result = simulate(rules, simVisits, reasons)

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/lpu/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          {lpu.nome}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-[var(--text)]">Simulação</h1>
              {lpu.ativa ? (
                <span className="rounded-full bg-[rgba(46,230,168,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--green)]">
                  Ativa
                </span>
              ) : (
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-[var(--text-3)]">
                  Rascunho
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              {lpu.nome} · {periodoLabel}
            </p>
          </div>

          {!lpu.ativa && (
            <form action={activateLpu.bind(null, id)}>
              <Button type="submit" size="sm" variant="outline">
                Ativar esta LPU
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Filtro de período */}
      <div className="mb-8 flex flex-wrap gap-2">
        {meses.map((m) => {
          const isActive = m.value === mesAtual
          return (
            <Link
              key={m.value}
              href={`/lpu/${id}/simulate?mes=${m.value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--cyan)] text-[var(--bg)]'
                  : 'bg-white/5 text-[var(--text-2)] hover:bg-white/10'
              }`}
            >
              {m.label}
            </Link>
          )
        })}
      </div>

      {simVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] py-16">
          <p className="text-sm text-[var(--text-3)]">Nenhuma visita encontrada para este período.</p>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Tente outro mês ou faça o upload de uma planilha.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs de visitas */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Visitas
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <CountCard label="Total" value={result.totalVisitas} />
              <CountCard label="Com regra" value={result.visitasComRegra} />
              <CountCard label="Sem regra" value={result.visitasSemRegra} highlight />
              <CountCard label="Conflito" value={result.visitasConflito} highlight />
              <CountCard label="Pendentes" value={result.visitasPendentes} highlight />
            </div>
          </div>

          {/* KPIs financeiros */}
          <div className="mb-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Financeiro
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MoneyCard label="Total estimado a pagar" value={result.totalEstimadoPagar} />
              <MoneyCard label="Receita total" value={result.receitaTotal} />
              <MoneyCard label="Margem" value={result.margem} variant="green" />
            </div>
          </div>

          {/* Distribuição por técnico */}
          <div className="mb-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Distribuição por Técnico ({result.distribuicaoPorTecnico.length})
            </p>
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="w-full">
                <thead className="bg-[var(--bg-1)]">
                  <tr>
                    {['Técnico', 'Visitas', 'Total estimado'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                  {result.distribuicaoPorTecnico.map((t) => (
                    <tr
                      key={t.tecnicoId ?? '__sem_tecnico__'}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 text-sm text-[var(--text)]">
                        {t.tecnicoId
                          ? (tecnicoNomes.get(t.tecnicoId) ?? 'Técnico desconhecido')
                          : 'Sem técnico'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-3)]">
                        {t.visitas}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                        {formatBRL(t.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visitas sem regra */}
          {result.visitasSemRegra > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                Visitas sem Regra ({result.visitasSemRegra})
              </p>
              <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                <table className="w-full">
                  <thead className="bg-[var(--bg-1)]">
                    <tr>
                      {['OS', 'Finalidade', 'Sucesso'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] bg-[var(--bg)]">
                    {result.visitasSemRegraDetalhes.map((v) => (
                      <tr key={v.visitId} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-sm text-[var(--text)]">
                          {v.osNum}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                          {v.finalidade ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-3)]">{v.sucesso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
