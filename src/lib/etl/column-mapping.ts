import type { RawRow } from './schemas'

export const COLUMN_MAP: Record<string, keyof RawRow> = {
  // Campos de data e identificação
  Data: 'Data',
  Inicio: 'Inicio',
  OS: 'OS',

  // Cliente / contrato
  'Usuário': 'Usuario',
  'Usu·rio': 'Usuario',
  'Usuario': 'Usuario',
  Contrato: 'Contrato',

  // Tipo de serviço
  Finalidade: 'Finalidade',
  Massiva: 'Massiva',
  'Tipo de atendimento': 'TipoAtendimento',
  'TipoAtendimento': 'TipoAtendimento',

  // Categorias
  Cat1: 'Cat1',
  Cat2: 'Cat2',
  Cat3: 'Cat3',
  'Cat 1': 'Cat1',
  'Cat 2': 'Cat2',
  'Cat 3': 'Cat3',

  // Localização
  Cidade: 'Cidade',
  'Condomínio': 'Condominio',
  Condominio: 'Condominio',

  // Resultado da visita
  Sucesso: 'Sucesso',
  Improdutiva: 'Improdutiva',
  Agendada: 'Agendada',
  Agregada: 'Agregada',
  Rejeitada: 'Rejeitada',
  Validada: 'Validada',
  Garantia: 'Garantia',

  // Infraestrutura
  'Trocado Drop': 'TrocadoDrop',
  TrocadoDrop: 'TrocadoDrop',
  'Motivo Troca': 'MotivoTroca',
  'Motivo troca': 'MotivoTroca',
  MotivoTroca: 'MotivoTroca',
  'Subterrâneo/Aéreo': 'SubterraneoAereo',
  'Subterraneo/Aereo': 'SubterraneoAereo',
  'Subterr‚neo/AÈreo': 'SubterraneoAereo',  // encoding Windows-1252
  SubterraneoAereo: 'SubterraneoAereo',
  'Outras Fibras': 'OutrasFibras',
  'Possui outras fibras entrando': 'OutrasFibras',
  OutrasFibras: 'OutrasFibras',
  'Quantas Fibras': 'QuantasFibras',
  QuantasFibras: 'QuantasFibras',

  // Equipe
  'Nº Técnicos': 'NumTecnicos',
  'Num Tecnicos': 'NumTecnicos',
  NumTecnicos: 'NumTecnicos',
  'TÈcnicos': 'NumTecnicos',   // encoding Windows-1252 de "Técnicos"
  'Técnico': 'Tecnico',
  'TÈcnico': 'Tecnico',
  Tecnico: 'Tecnico',

  // Financeiro
  Valor: 'Valor',
  'Explicação Valor': 'ExplicacaoValor',
  'Explicação do valor': 'ExplicacaoValor',
  'ExplicaÁ„o do valor': 'ExplicacaoValor',  // encoding Windows-1252
  ExplicacaoValor: 'ExplicacaoValor',
  'Drop Usado': 'DropUsado',
  DropUsado: 'DropUsado',
  'Faixa Drop': 'FaixaDrop',
  'Faixa de drop': 'FaixaDrop',
  FaixaDrop: 'FaixaDrop',
  'Conectores Usados': 'ConectoresUsados',
  ConectoresUsados: 'ConectoresUsados',

  // Observações e categorização interna
  'Observações': 'Observacoes',
  'ObservaÁıes': 'Observacoes',             // encoding Windows-1252
  Observacoes: 'Observacoes',
  'Categoria Interna': 'CategoriaInterna',
  CategoriaInterna: 'CategoriaInterna',
}
