import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Plus, ClipboardCheck } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ChecklistItemsTable } from './_components/ChecklistItemsTable'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Checklist de supervisão' }

export type ChecklistItemRow = {
  id: string
  codigo: string | null
  titulo: string
  descricao: string | null
  categoria: string | null
  peso: string
  ordem: number
  ativo: boolean
  foto_obrigatoria: boolean
  tipo_resposta: string
}

export default async function ChecklistPage() {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('supervision_checklist_items')
    .select('id, codigo, titulo, descricao, categoria, peso, ordem, ativo, foto_obrigatoria, tipo_resposta')
    .eq('tenant_id', user.tenantId!)
    .order('ativo', { ascending: false })
    .order('ordem', { ascending: true })
    .order('titulo', { ascending: true })

  // Erro do PostgREST é silencioso — sem isto, uma falha vira "nenhum item" na tela.
  if (error) {
    console.error('[checklist] falha ao ler supervision_checklist_items:', error)
  }

  const itens = (data ?? []) as ChecklistItemRow[]
  const ativos = itens.filter((i) => i.ativo)

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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text)]">
              Checklist de supervisão
            </h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              {ativos.length} {ativos.length === 1 ? 'item ativo' : 'itens ativos'}
              {itens.length > ativos.length && ` · ${itens.length - ativos.length} desativado(s)`}
            </p>
          </div>

          <Link
            href="/supervisoes/checklist/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--cyan)] px-4 py-2.5 text-sm font-semibold text-[#04121a] transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Novo item
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-[var(--line)] bg-white/[0.02] p-4">
        <p className="text-sm text-[var(--text-2)]">
          Estes são os itens que o supervisor responde em campo. Ao agendar uma supervisão, os
          itens <strong className="text-[var(--text)]">ativos</strong> são copiados para ela —
          editar ou desativar um item depois <strong className="text-[var(--text)]">não altera
          supervisões já agendadas</strong>, nem a nota delas.
        </p>
      </div>

      {itens.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum item cadastrado"
          description="Crie o primeiro item de verificação para começar a agendar supervisões."
          cta={{ label: 'Novo item', href: '/supervisoes/checklist/novo' }}
        />
      ) : (
        <ChecklistItemsTable itens={itens} />
      )}
    </div>
  )
}
