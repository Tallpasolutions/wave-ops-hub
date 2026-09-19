'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'
import { buildSnapshot, podeAgendar, podeReatribuirSupervisor } from '@/lib/supervisao'
import type { ItemDoTemplate } from '@/lib/supervisao'

type Estado = { error: string | null; success?: boolean }

const vazioParaNulo = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null)

const agendarSchema = z.object({
  tecnicoId: z.string().uuid('Escolha o técnico a ser supervisionado'),
  supervisorUserId: z.string().uuid('Escolha o supervisor responsável'),
  // "AAAA-MM-DD" do <input type="date">. DATE no banco, sem hora — o dia da supervisão não
  // tem horário, e timestamptz geraria off-by-one em America/Sao_Paulo.
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data da supervisão'),
  empresa: z.enum(['unifique', 'unetvale']).optional().or(z.literal('')),
  cluster: z.string().trim().max(60, 'Cluster muito longo').optional().or(z.literal('')),
  localReferencia: z.string().trim().max(200, 'Local muito longo').optional().or(z.literal('')),
  observacoesGestor: z.string().trim().optional().or(z.literal('')),
})

export async function agendarSupervisao(
  _prevState: Estado,
  formData: FormData,
): Promise<Estado> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)

  const result = agendarSchema.safeParse({
    tecnicoId: formData.get('tecnicoId'),
    supervisorUserId: formData.get('supervisorUserId'),
    dataAgendada: formData.get('dataAgendada'),
    empresa: formData.get('empresa') ?? '',
    cluster: formData.get('cluster') ?? '',
    localReferencia: formData.get('localReferencia') ?? '',
    observacoesGestor: formData.get('observacoesGestor') ?? '',
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const d = result.data
  const tenantId = user.tenantId!
  const supabase = await createSupabaseServerClient()

  // O template é lido AGORA e congelado na supervisão. Só itens ativos entram, na ordem que
  // o gestor definiu.
  const { data: itensAtivos, error: erroItens } = await supabase
    .from('supervision_checklist_items')
    .select('id, codigo, titulo, descricao, categoria, peso, tipo_resposta, foto_obrigatoria')
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('titulo', { ascending: true })

  if (erroItens) {
    console.error('[supervisoes] falha ao ler o checklist:', erroItens)
    return { error: 'Não foi possível ler o checklist. Tente novamente.' }
  }

  if (!podeAgendar(itensAtivos ?? [])) {
    return {
      error: 'Nenhum item ativo no checklist. Configure o checklist antes de agendar.',
    }
  }

  const { data: supervisao, error: erroSupervisao } = await supabase
    .from('field_supervisions')
    .insert({
      tenant_id: tenantId,
      tecnico_id: d.tecnicoId,
      supervisor_user_id: d.supervisorUserId,
      agendada_por: user.id,
      data_agendada: d.dataAgendada,
      empresa: vazioParaNulo(d.empresa),
      cluster: vazioParaNulo(d.cluster),
      local_referencia: vazioParaNulo(d.localReferencia),
      observacoes_gestor: vazioParaNulo(d.observacoesGestor),
    })
    .select('id')
    .single()

  if (erroSupervisao || !supervisao) {
    console.error('[supervisoes] falha ao criar supervisão:', erroSupervisao)
    return { error: 'Não foi possível agendar a supervisão. Tente novamente.' }
  }

  const linhas = buildSnapshot(itensAtivos as ItemDoTemplate[], {
    tenantId,
    supervisaoId: supervisao.id as string,
    supervisorUserId: d.supervisorUserId,
  })

  const { error: erroSnapshot } = await supabase.from('supervision_answers').insert(linhas)

  if (erroSnapshot) {
    // Supervisão sem checklist é inútil e confusa: o supervisor abriria uma tela vazia.
    // Desfaz para não deixar registro pela metade — ON DELETE CASCADE limpa o que entrou.
    console.error('[supervisoes] falha ao gravar o snapshot, desfazendo:', erroSnapshot)
    await supabase
      .from('field_supervisions')
      .delete()
      .eq('id', supervisao.id)
      .eq('tenant_id', tenantId)
    return { error: 'Não foi possível montar o checklist da supervisão. Tente novamente.' }
  }

  revalidatePath('/supervisoes')
  redirect(`/supervisoes/${supervisao.id}`)
}

export async function cancelarSupervisao(
  supervisaoId: string,
  _prevState: Estado,
  formData: FormData,
): Promise<Estado> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)

  const motivo = String(formData.get('motivo') ?? '').trim()
  if (motivo.length < 3) {
    return { error: 'Explique o motivo do cancelamento.' }
  }

  const supabase = await createSupabaseServerClient()

  // Concluída não cancela: a nota já foi congelada, e cancelar depois produziria histórico
  // divergente. A máquina de estados em lib/supervisao/status.ts é a fonte dessa regra.
  const { data: atual } = await supabase
    .from('field_supervisions')
    .select('status')
    .eq('id', supervisaoId)
    .eq('tenant_id', user.tenantId!)
    .maybeSingle()

  if (!atual) return { error: 'Supervisão não encontrada.' }
  if (atual.status === 'concluida') {
    return { error: 'Supervisão concluída não pode ser cancelada.' }
  }
  if (atual.status === 'cancelada') return { error: null, success: true }

  const { error } = await supabase
    .from('field_supervisions')
    .update({
      status: 'cancelada',
      cancelada_em: new Date().toISOString(),
      cancelada_por: user.id,
      motivo_cancelamento: motivo,
    })
    .eq('id', supervisaoId)
    .eq('tenant_id', user.tenantId!)

  if (error) {
    console.error('[supervisoes] falha ao cancelar:', error)
    return { error: 'Não foi possível cancelar. Tente novamente.' }
  }

  revalidatePath('/supervisoes')
  revalidatePath(`/supervisoes/${supervisaoId}`)
  return { error: null, success: true }
}

// Trocar o supervisor exige atualizar as DUAS tabelas: `supervisor_user_id` é desnormalizado
// em supervision_answers para a RLS filtrar sem join, e deixá-las divergentes faria o novo
// supervisor ver a supervisão mas não os itens dela.
export async function reatribuirSupervisor(
  supervisaoId: string,
  novoSupervisorUserId: string,
): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { data: atual } = await supabase
    .from('field_supervisions')
    .select('status')
    .eq('id', supervisaoId)
    .eq('tenant_id', user.tenantId!)
    .maybeSingle()

  // Só antes de a execução começar: depois já existem respostas e fotos carimbadas com o
  // supervisor antigo, e trocar exigiria migrar tudo em sincronia.
  if (!atual || !podeReatribuirSupervisor(atual.status as never)) return

  await supabase
    .from('field_supervisions')
    .update({ supervisor_user_id: novoSupervisorUserId })
    .eq('id', supervisaoId)
    .eq('tenant_id', user.tenantId!)

  await supabase
    .from('supervision_answers')
    .update({ supervisor_user_id: novoSupervisorUserId })
    .eq('supervisao_id', supervisaoId)
    .eq('tenant_id', user.tenantId!)

  revalidatePath('/supervisoes')
  revalidatePath(`/supervisoes/${supervisaoId}`)
}
