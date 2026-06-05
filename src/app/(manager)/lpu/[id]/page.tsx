import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Detalhe da LPU' }
import { Button } from '@/components/ui/button'
import { detectConflicts } from '@/lib/lpu'
import type { LpuRuleNarrowed } from '@/lib/lpu'
import { activateLpu, deactivateLpuRule, duplicateLpuRule } from '../actions'

export const dynamic = 'force-dynamic'

function formatVigencia(inicio: string, fim: string | null): string {
  const start = new Date(inicio + 'T00:00:00').toLocaleDateString('pt-BR')
  if (!fim) return `${start} → vigente`
  return `${start} → ${new Date(fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
}

function formatConditions(conditions: Record<string, unknown>): string {
  return Object.entries(conditions)
    .map(([k, v]) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const range = v as { min?: number; max?: number }
        const parts: string[] = []
        if (range.min !== undefined) parts.push(`≥ ${range.min}`)
        if (range.max !== undefined) parts.push(`≤ ${range.max}`)
        return `${k}: ${parts.join(', ')}`
      }
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`
      return `${k}: ${v}`
    })
    .join(' · ')
}

function formatPayout(payout: Record<string, unknown>): string {
  const type = payout.type
  if (type === 'fixed') {
    const value = (payout.value as number) ?? 0
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }
  if (type === 'formula') {
    const base = (payout.base as number) ?? 0
    const additional = payout.additional as { field: string; ratePerUnit: number } | undefined
    if (!additional) return `Base R$ ${base.toFixed(2).replace('.', ',')}`
    return `Base R$ ${base.toFixed(2).replace('.', ',')} + ${additional.field} × ${additional.ratePerUnit}`
  }
  if (type === 'percentage_of_revenue') {
    return `${payout.percentage}% da receita`
  }
  return '—'
}

type Props = { params: Promise<{ id: string }> }

export default async function LpuDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) notFound()

  const supabase = await createSupabaseServerClient()

  const [{ data: lpu }, { data: rulesRaw }] = await Promise.all([
    supabase.from('lpus').select('*').eq('id', id).single(),
    supabase
      .from('lpu_rules')
      .select('*')
      .eq('lpu_id', id)
      .order('prioridade', { ascending: false }),
  ])

  if (!lpu) notFound()

  const rules = (rulesRaw ?? []) as LpuRuleNarrowed[]
  const conflicts = detectConflicts(rules)

  const activateAction = activateLpu.bind(null, id)

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/lpu"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          LPU
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-[var(--text)]">{lpu.nome}</h1>
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
              {formatVigencia(lpu.vigencia_inicio, lpu.vigencia_fim)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!lpu.ativa && (
              <form action={activateAction}>
                <Button type="submit" size="sm" variant="outline">
                  Ativar esta LPU
                </Button>
              </form>
            )}
            <Link href={`/lpu/${id}/simulate`}>
              <Button size="sm" variant="outline" className="opacity-50">
                Simular
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Banner de conflitos */}
      {conflicts.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-[rgba(255,184,0,0.3)] bg-[rgba(255,184,0,0.06)] px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ffb800]" />
          <div>
            <p className="text-sm font-medium text-[#ffb800]">
              {conflicts.length === 1
                ? '1 conflito de prioridade detectado'
                : `${conflicts.length} conflitos de prioridade detectados`}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">
              Regras com mesma prioridade podem causar comportamento imprevisível. Ajuste as
              prioridades antes de ativar.
            </p>
            {conflicts.map((c) => (
              <p key={c.prioridade} className="mt-1 text-xs text-[var(--text-3)]">
                Prioridade {c.prioridade}:{' '}
                {c.rules.map((r) => r.description).join(' × ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de regras */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Regras ({rules.length})
        </p>
        <Link href={`/lpu/${id}/rules/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus size={14} />
            Nova Regra
          </Button>
        </Link>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] py-12">
          <p className="mb-4 text-sm text-[var(--text-3)]">Nenhuma regra cadastrada ainda.</p>
          <Link href={`/lpu/${id}/rules/new`}>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              Adicionar primeira regra
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-1)]">
              <tr>
                {['Prior.', 'Descrição', 'Condições', 'Payout', 'Status', ''].map((h) => (
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
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`transition-colors hover:bg-white/[0.02] ${!rule.ativa ? 'opacity-40' : ''}`}
                >
                  <td className="px-4 py-3 text-sm font-mono font-medium text-[var(--text)]">
                    {rule.prioridade}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-sm text-[var(--text)]">
                    <span className="block truncate">{rule.description}</span>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-[var(--text-3)]">
                    <span className="block truncate font-mono">
                      {formatConditions(rule.conditions as Record<string, unknown>)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                    {formatPayout(rule.payout as Record<string, unknown>)}
                  </td>
                  <td className="px-4 py-3">
                    {rule.ativa ? (
                      <span className="text-xs text-[var(--green)]">Ativa</span>
                    ) : (
                      <span className="text-xs text-[var(--text-3)]">Inativa</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/lpu/${id}/rules/${rule.id}/edit`}
                        className="text-xs font-medium text-[var(--cyan)] transition-colors hover:text-[var(--cyan)]/80"
                      >
                        Editar
                      </Link>
                      {rule.ativa && (
                        <>
                          <form action={duplicateLpuRule.bind(null, rule.id, id)}>
                            <button
                              type="submit"
                              className="text-xs font-medium text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
                            >
                              Duplicar
                            </button>
                          </form>
                          <form action={deactivateLpuRule.bind(null, rule.id, id)}>
                            <button
                              type="submit"
                              className="text-xs font-medium text-[var(--red)] transition-colors hover:text-[var(--red)]/80"
                            >
                              Desativar
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
