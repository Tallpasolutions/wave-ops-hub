'use server'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  requireSupervisaoCampo,
  SUPERVISAO_ROLES_SUPERVISOR,
} from '@/lib/supervisao/guard'
import {
  calcularNota,
  isChecklistCompleto,
  podeTransicionar,
  isParecerValido,
  type StatusSupervisao,
} from '@/lib/supervisao'

const BUCKET = 'supervisao-fotos'

type Estado = { error: string | null; success?: boolean }

// Toda action daqui confirma que a supervisão é DO CHAMADOR. A RLS já filtra, mas sem o
// filtro explícito um id de outra pessoa viraria "0 linhas afetadas" em silêncio, e a tela
// diria que salvou.
async function carregarMinhaSupervisao(supervisaoId: string, userId: string) {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('field_supervisions')
    .select('id, status, tenant_id')
    .eq('id', supervisaoId)
    .eq('supervisor_user_id', userId)
    .maybeSingle()
  return { supabase, supervisao: data }
}

// ── Os três momentos em campo ──────────────────────────────────────────────────────────────
// Cada botão carimba a hora. É o que o gestor acompanha na agenda sem ligar para ninguém.
export async function avancarStatus(
  supervisaoId: string,
  proximo: StatusSupervisao,
): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const { supabase, supervisao } = await carregarMinhaSupervisao(supervisaoId, user.id)
  if (!supervisao) return

  const atual = supervisao.status as StatusSupervisao
  // A máquina de estados é a fonte da regra. Sem esta checagem, um clique duplo ou um botão
  // de uma aba velha faria a supervisão pular etapa.
  if (!podeTransicionar(atual, proximo)) return
  // Concluir tem regra própria (nota, parecer, fotos) — não passa por aqui.
  if (proximo === 'concluida') return

  const agora = new Date().toISOString()
  const campos: Record<string, unknown> = { status: proximo }
  if (proximo === 'em_deslocamento') campos.deslocamento_iniciado_em = agora
  if (proximo === 'em_execucao') {
    campos.iniciada_em = agora
    // Chegou ao local: só carimba se veio do deslocamento. Quem pulou a saída não tem
    // chegada para registrar, e inventar uma seria dado falso.
    if (atual === 'em_deslocamento') campos.chegada_em = agora
  }

  await supabase
    .from('field_supervisions')
    .update(campos)
    .eq('id', supervisaoId)
    .eq('supervisor_user_id', user.id)

  revalidatePath('/minhas-supervisoes')
  revalidatePath(`/minhas-supervisoes/${supervisaoId}`)
}

// ── Resposta de um item ────────────────────────────────────────────────────────────────────
// Salva item a item, não o formulário inteiro: em campo o sinal cai, e a perda máxima
// precisa ser um item (ADR-022, limitação conhecida — não há fila offline na v1).
const responderSchema = z.object({
  resposta: z.enum(['conforme', 'nao_conforme', 'necessita_troca', 'nao_se_aplica']),
  observacao: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function responderItem(
  supervisaoId: string,
  answerId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const { supabase, supervisao } = await carregarMinhaSupervisao(supervisaoId, user.id)
  if (!supervisao || supervisao.status !== 'em_execucao') return

  const result = responderSchema.safeParse({
    resposta: formData.get('resposta'),
    observacao: formData.get('observacao') ?? '',
  })
  if (!result.success) return

  const observacao = result.data.observacao?.trim() || null

  await supabase
    .from('supervision_answers')
    .update({
      resposta: result.data.resposta,
      observacao,
      respondida_em: new Date().toISOString(),
    })
    .eq('id', answerId)
    .eq('supervisao_id', supervisaoId)
    .eq('supervisor_user_id', user.id)

  revalidatePath(`/minhas-supervisoes/${supervisaoId}`)
}

// ── Fotos ──────────────────────────────────────────────────────────────────────────────────
// Mesmo fluxo do upload de planilha: a Server Action só cria a linha e devolve uma URL
// assinada; o ARQUIVO vai direto do navegador para o Storage, sem passar pelo servidor.
export async function prepararFoto(
  supervisaoId: string,
  answerId: string | null,
  fileName: string,
  mimeType: string,
  tamanhoBytes: number,
): Promise<{ error: string | null; fotoId?: string; signedUrl?: string }> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const { supabase, supervisao } = await carregarMinhaSupervisao(supervisaoId, user.id)
  if (!supervisao) return { error: 'Supervisão não encontrada.' }
  if (supervisao.status !== 'em_execucao') {
    return { error: 'A vistoria precisa estar em andamento para anexar fotos.' }
  }

  const tenantId = supervisao.tenant_id as string
  const storagePath = `${tenantId}/${supervisaoId}/${randomUUID()}.jpg`

  const { data: foto, error: erroLinha } = await supabase
    .from('supervision_photos')
    .insert({
      tenant_id: tenantId,
      supervisao_id: supervisaoId,
      supervisor_user_id: user.id,
      answer_id: answerId,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      tamanho_bytes: tamanhoBytes,
      enviada_por: user.id,
    })
    .select('id')
    .single()

  if (erroLinha || !foto) {
    console.error('[supervisao] falha ao registrar foto:', erroLinha)
    return { error: 'Não foi possível preparar o envio. Tente novamente.' }
  }

  const admin = createSupabaseAdminClient()
  const { data: assinada, error: erroUrl } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (erroUrl || !assinada) {
    // Sem URL não há upload possível: apaga a linha para não deixar registro órfão.
    await supabase.from('supervision_photos').delete().eq('id', foto.id)
    console.error('[supervisao] falha ao assinar upload:', erroUrl)
    return { error: 'Não foi possível preparar o envio. Tente novamente.' }
  }

  return { error: null, fotoId: foto.id as string, signedUrl: assinada.signedUrl }
}

// `uploaded_em` só é gravado depois do PUT confirmado pelo navegador. Toda leitura filtra por
// ele, então upload abortado vira lixo invisível em vez de foto quebrada na tela.
export async function confirmarFoto(supervisaoId: string, fotoId: string): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const supabase = await createSupabaseServerClient()

  await supabase
    .from('supervision_photos')
    .update({ uploaded_em: new Date().toISOString() })
    .eq('id', fotoId)
    .eq('supervisor_user_id', user.id)

  revalidatePath(`/minhas-supervisoes/${supervisaoId}`)
}

// ── Conclusão ──────────────────────────────────────────────────────────────────────────────
const concluirSchema = z.object({
  parecerFinal: z.string().refine(isParecerValido, 'Escolha o parecer final'),
  parecerObservacao: z.string().trim().max(2000).optional().or(z.literal('')),
  notaQualidadeTecnica: z.coerce
    .number()
    .int()
    .min(1, 'A nota de qualidade vai de 1 a 10')
    .max(10, 'A nota de qualidade vai de 1 a 10')
    .optional(),
})

export async function concluirSupervisao(
  supervisaoId: string,
  _prevState: Estado,
  formData: FormData,
): Promise<Estado> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_SUPERVISOR)
  const { supabase, supervisao } = await carregarMinhaSupervisao(supervisaoId, user.id)
  if (!supervisao) return { error: 'Supervisão não encontrada.' }

  // Idempotente: clique duplo ou reenvio não recalcula nem sobrescreve a nota congelada.
  if (supervisao.status === 'concluida') return { error: null, success: true }
  if (!podeTransicionar(supervisao.status as StatusSupervisao, 'concluida')) {
    return { error: 'Inicie a vistoria antes de finalizar.' }
  }

  const notaBruta = formData.get('notaQualidadeTecnica')
  const result = concluirSchema.safeParse({
    parecerFinal: formData.get('parecerFinal'),
    parecerObservacao: formData.get('parecerObservacao') ?? '',
    notaQualidadeTecnica: notaBruta ? notaBruta : undefined,
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { data: respostas, error: erroRespostas } = await supabase
    .from('supervision_answers')
    .select('id, item_peso, item_titulo, item_foto_obrigatoria, resposta')
    .eq('supervisao_id', supervisaoId)

  if (erroRespostas || !respostas) {
    console.error('[supervisao] falha ao ler respostas:', erroRespostas)
    return { error: 'Não foi possível ler o checklist. Tente novamente.' }
  }

  const itens = respostas.map((r) => ({
    peso: Number(r.item_peso),
    resposta: r.resposta as never,
  }))

  if (!isChecklistCompleto(itens)) {
    const faltam = itens.filter((i) => i.resposta === null).length
    return {
      error: `Falta responder ${faltam} ${faltam === 1 ? 'item' : 'itens'} do checklist.`,
    }
  }

  // A trava que o gestor configurou no template: item marcado como "exige foto" não fecha sem
  // evidência. É aqui que a decisão dele passa a valer — o supervisor não tem como pular.
  const idsQueExigemFoto = respostas
    .filter((r) => r.item_foto_obrigatoria)
    .map((r) => r.id as string)

  if (idsQueExigemFoto.length > 0) {
    const { data: fotos } = await supabase
      .from('supervision_photos')
      .select('answer_id')
      .eq('supervisao_id', supervisaoId)
      .not('uploaded_em', 'is', null)

    const comFoto = new Set(
      ((fotos ?? []) as { answer_id: string | null }[]).map((f) => f.answer_id),
    )
    const semFoto = respostas.filter(
      (r) => r.item_foto_obrigatoria && !comFoto.has(r.id as string),
    )

    if (semFoto.length > 0) {
      const nomes = semFoto.slice(0, 3).map((r) => r.item_titulo as string).join(', ')
      const resto = semFoto.length > 3 ? ` e mais ${semFoto.length - 3}` : ''
      return { error: `Falta foto em: ${nomes}${resto}.` }
    }
  }

  const resultado = calcularNota(itens)
  const agora = new Date().toISOString()

  const { error } = await supabase
    .from('field_supervisions')
    .update({
      status: 'concluida',
      concluida_em: agora,
      parecer_final: result.data.parecerFinal,
      parecer_observacao: result.data.parecerObservacao?.trim() || null,
      nota_qualidade_tecnica: result.data.notaQualidadeTecnica ?? null,
      // Nota CONGELADA aqui. Nunca recalculada em leitura — mesmo princípio de
      // payouts.valor_calculado.
      nota: resultado.nota,
      nota_calculada_em: agora,
      itens_total: itens.length,
      itens_conformes: resultado.conformes,
      itens_nao_conformes: resultado.naoConformes + resultado.necessitamTroca,
      itens_nao_aplica: resultado.naoSeAplica,
    })
    .eq('id', supervisaoId)
    .eq('supervisor_user_id', user.id)

  if (error) {
    console.error('[supervisao] falha ao concluir:', error)
    return { error: 'Não foi possível finalizar. Tente novamente.' }
  }

  revalidatePath('/minhas-supervisoes')
  revalidatePath(`/minhas-supervisoes/${supervisaoId}`)
  return { error: null, success: true }
}
