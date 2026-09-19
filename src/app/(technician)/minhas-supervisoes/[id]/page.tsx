import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  requireSupervisaoCampo,
  SUPERVISAO_ROLES_SUPERVISOR,
} from '@/lib/supervisao/guard'
import type { StatusSupervisao } from '@/lib/supervisao'
import { supervisaoStatusLabel, notaLabel, parecerLabel } from '@/lib/labels/supervisao'
import { BotaoAcao } from './_components/BotaoAcao'
import { ItemExecutor, type ItemExec } from './_components/ItemExecutor'
import { ConcluirForm } from './_components/ConcluirForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Supervisão' }

type Props = { params: Promise<{ id: string }> }

function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export default async function ExecutarSupervisaoPage({ params }: Props) {
  const { id } = await params
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const supabase = await createSupabaseServerClient()

  // Filtro explícito por supervisor_user_id além da RLS: id de outra pessoa vira "não
  // encontrado", não uma tela meio carregada.
  const { data: s, error } = await supabase
    .from('field_supervisions')
    .select(
      `id, status, data_agendada, nota, parecer_final, cluster, local_referencia,
       observacoes_gestor, technicians(nome_completo)`,
    )
    .eq('id', id)
    .eq('supervisor_user_id', user.id)
    .maybeSingle()

  if (error) console.error('[minhas-supervisoes] falha ao ler:', error)
  if (!s) notFound()

  const [{ data: respostasRaw }, { data: fotos }] = await Promise.all([
    supabase
      .from('supervision_answers')
      .select(
        `id, ordem, item_codigo, item_titulo, item_descricao, item_tipo_resposta,
         item_foto_obrigatoria, resposta, observacao`,
      )
      .eq('supervisao_id', id)
      .order('ordem', { ascending: true }),
    supabase
      .from('supervision_photos')
      .select('answer_id')
      .eq('supervisao_id', id)
      .not('uploaded_em', 'is', null),
  ])

  const fotosPorResposta = new Map<string, number>()
  for (const f of (fotos ?? []) as { answer_id: string | null }[]) {
    if (!f.answer_id) continue
    fotosPorResposta.set(f.answer_id, (fotosPorResposta.get(f.answer_id) ?? 0) + 1)
  }

  const itens: ItemExec[] = ((respostasRaw ?? []) as unknown as ItemExec[]).map((r) => ({
    ...r,
    fotos: fotosPorResposta.get(r.id) ?? 0,
  }))

  const status = s.status as StatusSupervisao
  const editavel = status === 'em_execucao'
  const tech = Array.isArray(s.technicians) ? s.technicians[0] : s.technicians
  const rotulo = supervisaoStatusLabel(status)

  const pendentes = itens.filter((i) => i.resposta === null).length
  const semFoto = itens.filter((i) => i.item_foto_obrigatoria && i.fotos === 0).length
  const respondidos = itens.length - pendentes

  return (
    <div className="p-4 pb-8">
      <Link
        href="/minhas-supervisoes"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)]"
      >
        <ArrowLeft size={14} />
        Campo
      </Link>

      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold text-[var(--text)]">
            {tech?.nome_completo ?? 'Técnico'}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rotulo.cls}`}
          >
            {rotulo.curto}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-3)]">
          {dataBR(s.data_agendada as string)}
          {s.local_referencia ? ` · ${s.local_referencia}` : ''}
          {s.cluster ? ` · ${s.cluster}` : ''}
        </p>
      </div>

      {s.observacoes_gestor && (
        <div className="mb-4 rounded-xl border border-[var(--line)] bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Orientação da Wave
          </p>
          <p className="mt-1 text-sm text-[var(--text-2)]">{s.observacoes_gestor}</p>
        </div>
      )}

      {/* Botão de ação colado no topo: é a primeira coisa que o supervisor faz ao abrir. */}
      <div className="mb-5">
        <BotaoAcao supervisaoId={s.id as string} status={status} />
      </div>

      {status === 'concluida' && (
        <div className="mb-5 rounded-xl border border-[rgba(46,230,168,0.2)] bg-[rgba(46,230,168,0.05)] p-4">
          <p className="text-sm text-[var(--text)]">
            Vistoria finalizada
            {s.nota !== null && (
              <>
                {' '}
                com <strong>{notaLabel(s.nota as string)}</strong> de 100
              </>
            )}
            {s.parecer_final && <> · {parecerLabel(s.parecer_final as string).curto}</>}
          </p>
        </div>
      )}

      {status === 'agendada' && (
        <p className="mb-5 text-sm text-[var(--text-3)]">
          O checklist abre quando você iniciar a vistoria.
        </p>
      )}

      {status !== 'agendada' && (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Checklist
            </h2>
            <span className="text-xs text-[var(--text-3)]">
              {respondidos} de {itens.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {itens.map((item) => (
              <ItemExecutor
                key={item.id}
                supervisaoId={s.id as string}
                item={item}
                editavel={editavel}
              />
            ))}
          </div>
        </>
      )}

      {editavel && (
        <section className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Finalizar
          </h2>
          <ConcluirForm
            supervisaoId={s.id as string}
            pendentes={pendentes}
            semFoto={semFoto}
          />
        </section>
      )}
    </div>
  )
}
