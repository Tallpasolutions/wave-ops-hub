// Fonte única dos nomes de campo da visita, usados nas telas de auditoria
// (/visitas/[id] e /uploads/[id]/audit) para mostrar o que mudou em cada alteração.
//
// Antes o mapa era duplicado nas duas telas, com listas diferentes, e ambas caíam em
// `?? key`: campo fora do mapa aparecia como `subterraneo_aereo`, `explicacao_valor`,
// `lpu_rule_id` — nome de coluna do banco na tela do gestor.
//
// As chaves são o snake_case exato de `service_visits` (0001_initial_schema.sql).

const CAMPOS: Record<string, string> = {
  os_num: 'OS',
  data_execucao: 'Data de execução',
  tecnico_id: 'Técnico',
  tecnico_raw: 'Técnico (nome na planilha)',
  reason_id: 'Motivo',
  sucesso: 'Sucesso',
  improdutiva: 'Improdutiva',
  valor_recebido_unetvale: 'Valor recebido',
  finalidade: 'Finalidade',
  tipo_atendimento: 'Tipo de atendimento',
  cidade: 'Cidade',
  garantia: 'Garantia',
  validada: 'Validada',
  agregada: 'Venda atrelada',
  rejeitada: 'Rejeitada',
  agendada: 'Agendada',
  trocado_drop: 'Trocou o drop',
  outras_fibras: 'Outras fibras',
  drop_usado: 'Drop usado',
  faixa_drop: 'Faixa de drop',
  conectores_usados: 'Conectores usados',
  observacoes: 'Observações',
  explicacao_valor: 'Explicação do valor',
  num_tecnicos: 'Nº de técnicos',
  condominio: 'Condomínio',
  subterraneo_aereo: 'Rede',
  motivo_troca: 'Motivo da troca',
  cat1: 'Categoria 1',
  cat2: 'Categoria 2',
  cat3: 'Categoria 3',
  categoria_interna: 'Categoria interna',
  quantas_fibras: 'Qtd. de fibras',
  cliente_usuario: 'Cliente',
  contrato: 'Contrato',
  fora_escopo: 'Fora do escopo',
}

// Converte snake_case em texto legível como último recurso: uma coluna nova aparece como
// "Ponto adicional", não `ponto_adicional`. Nome de coluna nunca chega ao gestor.
function humanizar(chave: string): string {
  const t = chave.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function campoLabel(chave: string): string {
  return CAMPOS[chave] ?? humanizar(chave)
}

// Campos que nunca aparecem na auditoria: controle interno ou dados de infra que a Wave
// pediu para esconder (2026-06).
export const CAMPOS_OCULTOS_AUDITORIA = new Set([
  'id',
  'tenant_id',
  'upload_id',
  'created_at',
  'updated_at',
  'content_hash',
  'drop_usado',
  'faixa_drop',
  'conectores_usados',
  'trocado_drop',
  'motivo_troca',
  'outras_fibras',
  'quantas_fibras',
])
