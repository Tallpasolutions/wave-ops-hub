'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isUniqueViolation } from '@/lib/supabase/errors'
import { requireSupervisaoCampo, SUPERVISAO_ROLES_GESTOR } from '@/lib/supervisao/guard'

// Template do checklist de supervisão de campo (ADR-022).
//
// Regra que atravessa este arquivo: NADA AQUI APAGA. Desativar é `ativo = false`, porque as
// respostas históricas referenciam o item, e porque a supervisão já agendada carrega uma cópia
// congelada dele — apagar a origem quebraria o rastro sem mudar nenhuma nota.

const itemSchema = z.object({
  titulo: z.string().trim().min(3, 'O título precisa de pelo menos 3 caracteres'),
  codigo: z.string().trim().max(32, 'Código muito longo').optional().or(z.literal('')),
  descricao: z.string().trim().optional().or(z.literal('')),
  categoria: z.string().trim().max(60, 'Categoria muito longa').optional().or(z.literal('')),
  peso: z.coerce
    .number({ invalid_type_error: 'Peso precisa ser um número' })
    .positive('Peso precisa ser maior que zero')
    .max(9999, 'Peso muito alto'),
  ordem: z.coerce
    .number({ invalid_type_error: 'Ordem precisa ser um número' })
    .int('Ordem precisa ser um número inteiro')
    .min(0, 'Ordem não pode ser negativa'),
})

type Estado = { error: string | null; success?: boolean }

// Campo de texto vazio vira null: '' e null significam a mesma coisa aqui, e guardar string
// vazia faria o índice único de código tratar dois itens "sem código" como duplicados.
const vazioParaNulo = (v: string | undefined) => (v && v.trim() ? v.trim() : null)

function lerFormulario(formData: FormData) {
  return itemSchema.safeParse({
    titulo: formData.get('titulo'),
    codigo: formData.get('codigo'),
    descricao: formData.get('descricao'),
    categoria: formData.get('categoria'),
    peso: formData.get('peso'),
    ordem: formData.get('ordem'),
  })
}

export async function createChecklistItem(
  _prevState: Estado,
  formData: FormData,
): Promise<Estado> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)

  const result = lerFormulario(formData)
  if (!result.success) return { error: result.error.errors[0].message }

  const { titulo, codigo, descricao, categoria, peso, ordem } = result.data
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.from('supervision_checklist_items').insert({
    tenant_id: user.tenantId!,
    titulo: titulo.trim(),
    codigo: vazioParaNulo(codigo),
    descricao: vazioParaNulo(descricao),
    categoria: vazioParaNulo(categoria),
    peso,
    ordem,
    created_by: user.id,
  })

  if (error) {
    if (isUniqueViolation(error)) return { error: 'Já existe um item com esse código.' }
    return { error: 'Não foi possível salvar o item. Tente novamente.' }
  }

  revalidatePath('/supervisoes/checklist')
  redirect('/supervisoes/checklist')
}

export async function updateChecklistItem(
  itemId: string,
  _prevState: Estado,
  formData: FormData,
): Promise<Estado> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)

  const result = lerFormulario(formData)
  if (!result.success) return { error: result.error.errors[0].message }

  const { titulo, codigo, descricao, categoria, peso, ordem } = result.data
  const supabase = await createSupabaseServerClient()

  // `updated_at` NÃO é setado aqui: o trigger set_updated_at() cuida disso (CLAUDE.md §6).
  const { error } = await supabase
    .from('supervision_checklist_items')
    .update({
      titulo: titulo.trim(),
      codigo: vazioParaNulo(codigo),
      descricao: vazioParaNulo(descricao),
      categoria: vazioParaNulo(categoria),
      peso,
      ordem,
    })
    .eq('id', itemId)
    .eq('tenant_id', user.tenantId!)

  if (error) {
    if (isUniqueViolation(error)) return { error: 'Já existe um item com esse código.' }
    return { error: 'Não foi possível salvar as alterações. Tente novamente.' }
  }

  revalidatePath('/supervisoes/checklist')
  revalidatePath(`/supervisoes/checklist/${itemId}/edit`)
  return { error: null, success: true }
}

// Ativar/desativar em vez de apagar. Um item desativado some das supervisões NOVAS, mas
// continua intacto nas que já existem — é o que preserva o histórico e a nota delas.
export async function toggleChecklistItem(itemId: string, ativo: boolean): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  await supabase
    .from('supervision_checklist_items')
    .update({ ativo })
    .eq('id', itemId)
    .eq('tenant_id', user.tenantId!)

  revalidatePath('/supervisoes/checklist')
}

// Move o item uma posição para cima ou para baixo, trocando a `ordem` com o vizinho.
// Reordenar por arrastar exigiria biblioteca nova, que o CLAUDE.md §3 condiciona a ADR.
export async function moveChecklistItem(
  itemId: string,
  direcao: 'cima' | 'baixo',
): Promise<void> {
  const user = await requireSupervisaoCampo(SUPERVISAO_ROLES_GESTOR)
  const supabase = await createSupabaseServerClient()

  const { data: itens } = await supabase
    .from('supervision_checklist_items')
    .select('id, ordem')
    .eq('tenant_id', user.tenantId!)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (!itens?.length) return

  const i = itens.findIndex((it) => it.id === itemId)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= itens.length) return

  const atual = itens[i]
  const vizinho = itens[j]

  // Itens criados com a mesma `ordem` empatariam e a troca não teria efeito visível.
  // Usa a posição na lista ordenada como desempate.
  const ordemAtual = atual.ordem === vizinho.ordem ? i : atual.ordem
  const ordemVizinho = atual.ordem === vizinho.ordem ? j : vizinho.ordem

  await Promise.all([
    supabase
      .from('supervision_checklist_items')
      .update({ ordem: ordemVizinho })
      .eq('id', atual.id)
      .eq('tenant_id', user.tenantId!),
    supabase
      .from('supervision_checklist_items')
      .update({ ordem: ordemAtual })
      .eq('id', vizinho.id)
      .eq('tenant_id', user.tenantId!),
  ])

  revalidatePath('/supervisoes/checklist')
}
