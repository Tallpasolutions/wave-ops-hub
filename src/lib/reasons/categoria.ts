import type { ReasonCategoria } from '@/db/schema'

// Fonte única da taxonomia de categoria de motivo (Sprint 13 Fase D).
// Todo rótulo, cor de badge e opção de formulário de categoria vem daqui — badge,
// filtro e formulário passam a exibir exatamente o mesmo texto. Antes desta unificação
// coexistiam "Falha Cliente" e "Falha do Cliente" em telas diferentes.

export const CATEGORIA_LABEL: Record<ReasonCategoria, string> = {
  falha_tecnico: 'Falha do Técnico',
  falha_cliente: 'Falha do Cliente',
  forca_maior: 'Força Maior',
  falha_sistema: 'Falha do Sistema',
  pendente_classificacao: 'Pendente',
}

export function categoriaLabel(categoria: string): string {
  return CATEGORIA_LABEL[categoria as ReasonCategoria] ?? categoria
}

export const CATEGORIA_BADGE_CLASS: Record<ReasonCategoria, string> = {
  falha_tecnico: 'bg-[rgba(255,184,0,0.12)] text-[#ffb800]',
  falha_cliente: 'bg-[rgba(30,107,255,0.12)] text-[var(--blue)]',
  forca_maior: 'bg-[rgba(160,100,255,0.12)] text-[#a064ff]',
  falha_sistema: 'bg-[rgba(255,200,0,0.10)] text-[#ffc800]',
  pendente_classificacao: 'bg-[rgba(255,84,112,0.13)] text-[var(--red)]',
}

export function categoriaBadgeClass(categoria: string): string {
  return (
    CATEGORIA_BADGE_CLASS[categoria as ReasonCategoria] ??
    'bg-white/5 text-[var(--text-3)]'
  )
}

// Categorias que o gestor pode atribuir a um motivo (exclui o estado inicial "pendente").
// A descrição orienta a classificação no formulário de edição do motivo.
export const CATEGORIA_CLASSIFICAVEL_OPTIONS: {
  value: Exclude<ReasonCategoria, 'pendente_classificacao'>
  label: string
  description: string
}[] = [
  {
    value: 'falha_tecnico',
    label: CATEGORIA_LABEL.falha_tecnico,
    description: 'Falha atribuível ao técnico (ex: sem tempo, endereço não encontrado)',
  },
  {
    value: 'falha_cliente',
    label: CATEGORIA_LABEL.falha_cliente,
    description: 'Cliente impediu a execução (ex: ausente, reagendou)',
  },
  {
    value: 'forca_maior',
    label: CATEGORIA_LABEL.forca_maior,
    description: 'Evento incontrolável (ex: chuva, sem viabilidade)',
  },
  {
    value: 'falha_sistema',
    label: CATEGORIA_LABEL.falha_sistema,
    description: 'Erro Unetvale/Wave (ex: OS criada incorreta, APR impedida)',
  },
]
