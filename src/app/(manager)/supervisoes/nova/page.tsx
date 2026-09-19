import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AgendarSupervisaoForm } from './_components/AgendarSupervisaoForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Agendar supervisão' }

export default async function NovaSupervisaoPage() {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const [{ data: tecnicos }, { data: supervisores }, { count: itensAtivos }] = await Promise.all([
    supabase
      .from('technicians')
      .select('id, nome_completo')
      .eq('tenant_id', user.tenantId!)
      .eq('ativo', true)
      .order('nome_completo', { ascending: true }),
    supabase
      .from('users')
      .select('id, nome_completo')
      .eq('tenant_id', user.tenantId!)
      .eq('role', 'tenant_supervisor')
      .eq('ativo', true)
      .order('nome_completo', { ascending: true }),
    supabase
      .from('supervision_checklist_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId!)
      .eq('ativo', true),
  ])

  // Sem checklist a supervisão nasceria impossível de concluir. A action também barra, mas
  // mandar de volta aqui evita o gestor preencher o formulário inteiro para levar erro.
  if ((itensAtivos ?? 0) === 0) redirect('/supervisoes/checklist')

  // Data local, não UTC: `toISOString()` devolve o dia seguinte depois das 21h em
  // America/Sao_Paulo, e o gestor veria a supervisão caindo em amanhã.
  const agora = new Date()
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

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
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">Agendar supervisão</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          O supervisor recebe no app e registra deslocamento, vistoria e conclusão.
        </p>
      </div>

      <AgendarSupervisaoForm
        tecnicos={(tecnicos ?? []).map((t) => ({ id: t.id as string, nome: t.nome_completo as string }))}
        supervisores={(supervisores ?? []).map((s) => ({ id: s.id as string, nome: s.nome_completo as string }))}
        hoje={hoje}
        itensAtivos={itensAtivos ?? 0}
      />
    </div>
  )
}
