import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, ListChecks, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseFiltros, temFiltroAtivo } from './_lib/filters'
import { SupervisoesFilters } from './_components/SupervisoesFilters'
import { SupervisoesTable, type SupervisaoRow } from './_components/SupervisoesTable'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Supervisões' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function SupervisoesPage({ searchParams }: Props) {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()
  const filtros = parseFiltros(await searchParams)

  let query = supabase
    .from('field_supervisions')
    .select(
      `id, status, data_agendada, nota, parecer_final, os_num_referencia, cluster,
       tecnico_id, supervisor_user_id,
       technicians(nome_completo)`,
    )
    .eq('tenant_id', user.tenantId!)
    .order('data_agendada', { ascending: false })
    .limit(200)

  if (filtros.status) query = query.eq('status', filtros.status)
  if (filtros.tecnicoId) query = query.eq('tecnico_id', filtros.tecnicoId)
  if (filtros.supervisorId) query = query.eq('supervisor_user_id', filtros.supervisorId)
  if (filtros.de) query = query.gte('data_agendada', filtros.de)
  if (filtros.ate) query = query.lte('data_agendada', filtros.ate)

  const [{ data, error }, { count: itensAtivos }] = await Promise.all([
    query,
    supabase
      .from('supervision_checklist_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId!)
      .eq('ativo', true),
  ])

  if (error) {
    console.error('[supervisoes] falha ao listar:', error)
  }

  const brutas = (data ?? []) as unknown as Array<{
    id: string
    status: string
    data_agendada: string
    nota: string | null
    parecer_final: string | null
    os_num_referencia: number | null
    cluster: string | null
    supervisor_user_id: string
    technicians: { nome_completo: string } | { nome_completo: string }[] | null
  }>

  // Nome do supervisor e contagem de fotos vêm em consultas próprias, não por embed:
  // field_supervisions tem 3 chaves estrangeiras para `users`, e o embed ficaria ambíguo.
  const supervisorIds = [...new Set(brutas.map((s) => s.supervisor_user_id))]
  const supervisaoIds = brutas.map((s) => s.id)

  const [{ data: usuarios }, { data: fotos }] = await Promise.all([
    supervisorIds.length
      ? supabase.from('users').select('id, nome_completo').in('id', supervisorIds)
      : Promise.resolve({ data: [] }),
    supervisaoIds.length
      ? supabase
          .from('supervision_photos')
          .select('supervisao_id')
          .in('supervisao_id', supervisaoIds)
          .not('uploaded_em', 'is', null)
      : Promise.resolve({ data: [] }),
  ])

  const nomePorUsuario = new Map(
    ((usuarios ?? []) as { id: string; nome_completo: string }[]).map((u) => [
      u.id,
      u.nome_completo,
    ]),
  )
  const fotosPorSupervisao = new Map<string, number>()
  for (const f of (fotos ?? []) as { supervisao_id: string }[]) {
    fotosPorSupervisao.set(f.supervisao_id, (fotosPorSupervisao.get(f.supervisao_id) ?? 0) + 1)
  }

  const linhas: SupervisaoRow[] = brutas.map((s) => {
    const tech = Array.isArray(s.technicians) ? s.technicians[0] : s.technicians
    return {
      id: s.id,
      status: s.status,
      data_agendada: s.data_agendada,
      nota: s.nota,
      parecer_final: s.parecer_final,
      os_num_referencia: s.os_num_referencia,
      cluster: s.cluster,
      tecnico: tech?.nome_completo ?? '—',
      supervisor: nomePorUsuario.get(s.supervisor_user_id) ?? '—',
      fotos: fotosPorSupervisao.get(s.id) ?? 0,
    }
  })

  const semChecklist = (itensAtivos ?? 0) === 0

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text)]">Supervisões</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Acompanhamento de campo dos técnicos, registrado pelo supervisor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/supervisoes/checklist"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--text-2)] transition-colors hover:border-[var(--cyan)] hover:text-[var(--text)]"
          >
            <ListChecks size={16} />
            Checklist
            {!semChecklist && (
              <span className="text-xs text-[var(--text-3)]">({itensAtivos})</span>
            )}
          </Link>

          {!semChecklist && (
            <Link
              href="/supervisoes/nova"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--cyan)] px-4 py-2.5 text-sm font-semibold text-[#04121a] transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Agendar
            </Link>
          )}
        </div>
      </div>

      {semChecklist ? (
        <EmptyState
          icon={ListChecks}
          title="Configure o checklist primeiro"
          description="Uma supervisão sem itens de verificação não tem o que responder nem como gerar nota. Cadastre os itens antes de agendar."
          cta={{ label: 'Ir para o checklist', href: '/supervisoes/checklist' }}
        />
      ) : (
        <>
          <SupervisoesFilters filtros={filtros} />

          {linhas.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={
                temFiltroAtivo(filtros)
                  ? 'Nenhuma supervisão com esses filtros'
                  : 'Nenhuma supervisão agendada'
              }
              description={
                temFiltroAtivo(filtros)
                  ? 'Ajuste ou limpe os filtros para ver as demais.'
                  : 'Agende a primeira para o supervisor registrar em campo.'
              }
              cta={
                temFiltroAtivo(filtros)
                  ? { label: 'Limpar filtros', href: '/supervisoes' }
                  : { label: 'Agendar supervisão', href: '/supervisoes/nova' }
              }
            />
          ) : (
            <SupervisoesTable linhas={linhas} />
          )}
        </>
      )}
    </div>
  )
}
