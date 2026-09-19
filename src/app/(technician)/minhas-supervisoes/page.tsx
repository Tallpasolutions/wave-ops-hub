import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  requireSupervisaoCampo,
  SUPERVISAO_ROLES_SUPERVISOR,
} from '@/lib/supervisao/guard'
import { estaEmAndamento, isTerminal, type StatusSupervisao } from '@/lib/supervisao'
import { supervisaoStatusLabel, notaLabel } from '@/lib/labels/supervisao'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Supervisões de campo' }

function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export default async function MinhasSupervisoesPage() {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('field_supervisions')
    .select('id, status, data_agendada, nota, cluster, local_referencia, technicians(nome_completo)')
    .eq('supervisor_user_id', user.id)
    .order('data_agendada', { ascending: false })
    .limit(100)

  if (error) console.error('[minhas-supervisoes] falha ao listar:', error)

  const linhas = (data ?? []) as unknown as Array<{
    id: string
    status: StatusSupervisao
    data_agendada: string
    nota: string | null
    cluster: string | null
    local_referencia: string | null
    technicians: { nome_completo: string } | { nome_completo: string }[] | null
  }>

  // Ordem de utilidade em campo: o que está acontecendo agora, depois o que falta fazer,
  // por último o histórico. Ordenar só por data faria a supervisão de hoje sumir no meio.
  const emAndamento = linhas.filter((s) => estaEmAndamento(s.status))
  const pendentes = linhas.filter((s) => s.status === 'agendada')
  const encerradas = linhas.filter((s) => isTerminal(s.status))

  if (linhas.length === 0) {
    return (
      <div className="p-4">
        <h1 className="font-display mb-4 text-2xl font-bold text-[var(--text)]">Campo</h1>
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma supervisão atribuída"
          description="Quando a Wave agendar uma supervisão para você, ela aparece aqui."
        />
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="font-display mb-1 text-2xl font-bold text-[var(--text)]">Campo</h1>
      <p className="mb-5 text-sm text-[var(--text-3)]">
        {pendentes.length > 0
          ? `${pendentes.length} ${pendentes.length === 1 ? 'supervisão agendada' : 'supervisões agendadas'}`
          : 'Nenhuma supervisão pendente'}
      </p>

      <div className="flex flex-col gap-6">
        <Grupo titulo="Acontecendo agora" linhas={emAndamento} />
        <Grupo titulo="Agendadas" linhas={pendentes} />
        <Grupo titulo="Encerradas" linhas={encerradas} />
      </div>
    </div>
  )
}

type LinhaProps = {
  id: string
  status: StatusSupervisao
  data_agendada: string
  nota: string | null
  cluster: string | null
  local_referencia: string | null
  technicians: { nome_completo: string } | { nome_completo: string }[] | null
}

function Grupo({ titulo, linhas }: { titulo: string; linhas: LinhaProps[] }) {
  if (linhas.length === 0) return null

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        {titulo}
      </h2>
      <div className="flex flex-col gap-2">
        {linhas.map((s) => {
          const tech = Array.isArray(s.technicians) ? s.technicians[0] : s.technicians
          const r = supervisaoStatusLabel(s.status)
          const local = s.local_referencia ?? s.cluster

          return (
            <Link
              key={s.id}
              href={`/minhas-supervisoes/${s.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-4 transition-colors active:bg-white/[0.04]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--text)]">
                    {tech?.nome_completo ?? 'Técnico'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.cls}`}
                  >
                    {r.curto}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-3)]">
                  {dataBR(s.data_agendada)}
                  {local ? ` · ${local}` : ''}
                  {s.nota !== null ? ` · ${notaLabel(s.nota)} pts` : ''}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-[var(--text-3)]" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
