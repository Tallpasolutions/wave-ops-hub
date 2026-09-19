import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { EditChecklistItemForm } from './_components/EditChecklistItemForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Editar item do checklist' }

type Props = { params: Promise<{ itemId: string }> }

export default async function EditChecklistItemPage({ params }: Props) {
  const { itemId } = await params
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { data: item, error } = await supabase
    .from('supervision_checklist_items')
    .select('id, codigo, titulo, descricao, categoria, peso, ordem, ativo, foto_obrigatoria, tipo_resposta')
    .eq('id', itemId)
    .eq('tenant_id', user.tenantId!)
    .maybeSingle()

  if (error) {
    console.error('[checklist] falha ao ler item:', error)
  }
  if (!item) notFound()

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
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Editar item</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Supervisões já agendadas carregam uma cópia deste item e{' '}
          <strong className="text-[var(--text-2)]">não mudam</strong> com esta edição.
        </p>
      </div>

      <EditChecklistItemForm
        itemId={item.id as string}
        ativo={item.ativo as boolean}
        valores={{
          titulo: item.titulo as string,
          codigo: item.codigo as string | null,
          descricao: item.descricao as string | null,
          categoria: item.categoria as string | null,
          peso: item.peso as string,
          ordem: item.ordem as number,
          tipoResposta: item.tipo_resposta as string,
          fotoObrigatoria: item.foto_obrigatoria as boolean,
        }}
      />
    </div>
  )
}
