import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isTerminal, type StatusSupervisao } from '@/lib/supervisao'
import { notaLabel, parecerLabel } from '@/lib/labels/supervisao'
import { StatusBadge } from '../_components/StatusBadge'
import { LinhaDoTempo } from './_components/LinhaDoTempo'
import { ChecklistResultado, type RespostaRow } from './_components/ChecklistResultado'
import { CancelarSupervisaoForm } from './_components/CancelarSupervisaoForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Supervisão' }

type Props = { params: Promise<{ id: string }> }

const EMPRESA_LABEL: Record<string, string> = {
  unifique: 'Unifique',
  unetvale: 'Unetvale',
}

function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export default async function SupervisaoDetalhePage({ params }: Props) {
  const { id } = await params
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { data: s, error } = await supabase
    .from('field_supervisions')
    .select(
      `id, status, data_agendada, nota, nota_qualidade_tecnica, parecer_final,
       parecer_observacao, os_num_referencia, cluster, empresa, local_referencia,
       observacoes_gestor, motivo_cancelamento, itens_total, itens_conformes,
       itens_nao_conformes, itens_nao_aplica, supervisor_user_id, created_at,
       deslocamento_iniciado_em, chegada_em, iniciada_em, concluida_em, cancelada_em,
       technicians(nome_completo)`,
    )
    .eq('id', id)
    .eq('tenant_id', user.tenantId!)
    .maybeSingle()

  if (error) console.error('[supervisoes] falha ao ler detalhe:', error)
  if (!s) notFound()

  const [{ data: respostasRaw }, { data: fotos }, { data: supervisorUser }] = await Promise.all([
    supabase
      .from('supervision_answers')
      .select(
        `id, ordem, item_codigo, item_titulo, item_categoria, item_peso, item_tipo_resposta,
         item_foto_obrigatoria, resposta, observacao`,
      )
      .eq('supervisao_id', id)
      .order('ordem', { ascending: true }),
    supabase
      .from('supervision_photos')
      .select('answer_id')
      .eq('supervisao_id', id)
      .not('uploaded_em', 'is', null),
    supabase
      .from('users')
      .select('nome_completo')
      .eq('id', s.supervisor_user_id as string)
      .maybeSingle(),
  ])

  const fotosPorResposta = new Map<string, number>()
  for (const f of (fotos ?? []) as { answer_id: string | null }[]) {
    if (!f.answer_id) continue
    fotosPorResposta.set(f.answer_id, (fotosPorResposta.get(f.answer_id) ?? 0) + 1)
  }

  const respostas: RespostaRow[] = ((respostasRaw ?? []) as unknown as RespostaRow[]).map((r) => ({
    ...r,
    fotos: fotosPorResposta.get(r.id) ?? 0,
  }))

  const tech = Array.isArray(s.technicians) ? s.technicians[0] : s.technicians
  const status = s.status as StatusSupervisao
  const parecer = s.parecer_final as string | null

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/supervisoes"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Supervisões
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">
            {tech?.nome_completo ?? 'Técnico'}
          </h1>
          <StatusBadge status={status} />
        </div>

        <p className="mt-1 text-sm text-[var(--text-3)]">
          {dataBR(s.data_agendada as string)}
          {supervisorUser?.nome_completo ? ` · ${supervisorUser.nome_completo}` : ''}
          {s.cluster ? ` · ${s.cluster}` : ''}
          {s.empresa ? ` · ${EMPRESA_LABEL[s.empresa as string] ?? s.empresa}` : ''}
          {s.os_num_referencia ? ` · OS ${s.os_num_referencia}` : ''}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {s.observacoes_gestor && (
            <section className="rounded-xl border border-[var(--line)] bg-white/[0.02] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                Orientação ao supervisor
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-2)]">{s.observacoes_gestor}</p>
            </section>
          )}

          {s.motivo_cancelamento && (
            <section className="rounded-xl border border-[rgba(255,84,112,0.2)] bg-[rgba(255,84,112,0.05)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--red)]">
                Motivo do cancelamento
              </p>
              <p className="mt-1.5 text-sm text-[var(--text-2)]">{s.motivo_cancelamento}</p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Checklist · {respostas.length} itens
            </h2>
            <ChecklistResultado respostas={respostas} />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Resultado
            </p>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-[var(--text)]">
                {notaLabel(s.nota as string | null)}
              </span>
              {s.nota !== null && <span className="text-sm text-[var(--text-3)]">/ 100</span>}
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">
              {/* Nota nula é "nenhum item avaliável", não zero. */}
              {s.nota === null ? 'Sem itens avaliáveis' : 'Calculada do checklist'}
            </p>

            {s.nota_qualidade_tecnica !== null && (
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Qualidade técnica
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text)]">
                  {s.nota_qualidade_tecnica}
                  <span className="text-sm font-normal text-[var(--text-3)]"> / 10</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-3)]">Impressão do supervisor</p>
              </div>
            )}

            {parecer && (
              <div className="mt-4 border-t border-[var(--line)] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
                  Parecer
                </p>
                <span
                  className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${parecerLabel(parecer).cls}`}
                >
                  {parecerLabel(parecer).curto}
                </span>
                {s.parecer_observacao && (
                  <p className="mt-2 text-sm text-[var(--text-2)]">{s.parecer_observacao}</p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Andamento
            </p>
            <LinhaDoTempo
              criadaEm={s.created_at as string}
              deslocamentoEm={s.deslocamento_iniciado_em as string | null}
              chegadaEm={s.chegada_em as string | null}
              iniciadaEm={s.iniciada_em as string | null}
              concluidaEm={s.concluida_em as string | null}
              canceladaEm={s.cancelada_em as string | null}
            />
          </section>

          {!isTerminal(status) && (
            <section className="rounded-xl border border-[var(--line)] p-5">
              <CancelarSupervisaoForm supervisaoId={s.id as string} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
