import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, ListChecks } from 'lucide-react'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Supervisões' }

export default async function SupervisoesPage() {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { count } = await supabase
    .from('supervision_checklist_items')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId!)
    .eq('ativo', true)

  const itensAtivos = count ?? 0

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Supervisões</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Acompanhamento de campo dos técnicos, registrado pelo supervisor.
        </p>
      </div>

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Link
          href="/supervisoes/checklist"
          className="rounded-xl border border-[var(--line)] bg-[var(--bg-1)] p-5 transition-colors hover:border-[var(--cyan)]"
        >
          <ListChecks size={20} className="text-[var(--cyan)]" />
          <p className="mt-3 font-medium text-[var(--text)]">Checklist</p>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            {itensAtivos === 0
              ? 'Nenhum item ativo — configure antes de agendar'
              : `${itensAtivos} ${itensAtivos === 1 ? 'item ativo' : 'itens ativos'}`}
          </p>
        </Link>

        <div className="rounded-xl border border-dashed border-[var(--line)] p-5 opacity-60">
          <ClipboardCheck size={20} className="text-[var(--text-3)]" />
          <p className="mt-3 font-medium text-[var(--text-2)]">Agendar supervisão</p>
          <p className="mt-1 text-sm text-[var(--text-3)]">Em breve</p>
        </div>
      </div>
    </div>
  )
}
