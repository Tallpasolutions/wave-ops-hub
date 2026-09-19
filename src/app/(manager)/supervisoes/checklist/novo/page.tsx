import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CreateChecklistItemForm } from './_components/CreateChecklistItemForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Novo item do checklist' }

export default async function NovoChecklistItemPage() {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  // Sugere a próxima posição livre, para o item novo cair no fim da lista em vez de empatar
  // em 0 com todos os outros.
  const { data: ultimo } = await supabase
    .from('supervision_checklist_items')
    .select('ordem')
    .eq('tenant_id', user.tenantId!)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaOrdem = ultimo ? Number(ultimo.ordem) + 1 : 0

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <Link
          href="/supervisoes/checklist"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Checklist
        </Link>
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Novo item</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Entra nas próximas supervisões agendadas. As que já existem não mudam.
        </p>
      </div>

      <CreateChecklistItemForm proximaOrdem={proximaOrdem} />
    </div>
  )
}
