// Cópia congelada do checklist no momento do agendamento (ADR-022, camada 2 do
// versionamento).
//
// É esta função que garante a promessa feita ao gestor em três telas: "editar o template não
// altera supervisão já agendada". A supervisão não referencia o item — ela carrega o texto,
// o peso, a escala e a exigência de foto dele. O `itemId` fica só para rastro, e é
// ON DELETE SET NULL justamente porque a integridade da nota não depende dele.
//
// Pura: sem I/O, sem Date. A action monta as linhas com isto e só então grava.

export interface ItemDoTemplate {
  id: string
  codigo: string | null
  titulo: string
  descricao: string | null
  categoria: string | null
  peso: string | number
  tipo_resposta: string
  foto_obrigatoria: boolean
}

export interface LinhaDeResposta {
  tenant_id: string
  supervisao_id: string
  supervisor_user_id: string
  item_id: string
  ordem: number
  item_codigo: string | null
  item_titulo: string
  item_descricao: string | null
  item_categoria: string | null
  item_peso: number
  item_tipo_resposta: string
  item_foto_obrigatoria: boolean
}

export interface ContextoSnapshot {
  tenantId: string
  supervisaoId: string
  supervisorUserId: string
}

export function buildSnapshot(
  itens: readonly ItemDoTemplate[],
  ctx: ContextoSnapshot,
): LinhaDeResposta[] {
  // `ordem` é REATRIBUÍDA de 1 a N, não copiada do template. O template pode ter buracos
  // (10, 11, 50...) ou empates depois de edições; dentro da supervisão a ordem precisa ser
  // densa e única, porque é a chave estável da UI e o que o índice único protege.
  return itens.map((item, i) => ({
    tenant_id: ctx.tenantId,
    supervisao_id: ctx.supervisaoId,
    supervisor_user_id: ctx.supervisorUserId,
    item_id: item.id,
    ordem: i + 1,
    item_codigo: item.codigo,
    item_titulo: item.titulo,
    item_descricao: item.descricao,
    item_categoria: item.categoria,
    item_peso: Number(item.peso),
    item_tipo_resposta: item.tipo_resposta,
    item_foto_obrigatoria: item.foto_obrigatoria,
  }))
}

// Agendar sem item nenhum produziria uma supervisão impossível de concluir: sem item não há
// nota, e o supervisor abriria uma tela vazia sem saber o que fazer.
export function podeAgendar(itensAtivos: readonly unknown[]): boolean {
  return itensAtivos.length > 0
}
