export type IngestCounts = {
  inseridas: number
  atualizadas: number
  ignoradas: number
  erros: number
}

export type IngestWarning = {
  unmatchedTechnicians: string[]
  newReasons: string[]
}

export type IngestError = {
  row: number
  field?: string
  message: string
}

export type IngestResult =
  | { status: 'success'; counts: IngestCounts; warnings: IngestWarning }
  | { status: 'failed'; error: string; errors?: IngestError[] }

export type NormalizedRow = {
  tenantId: string
  osNum: number
  uploadId: string
  dataExecucao: Date
  tecnicoId: string | null
  tecnicoRaw: string
  reasonId: string | null
  finalidade: string | null
  tipoAtendimento: 'Externo' | 'Interno' | null
  cidade: string | null
  sucesso: string
  improdutiva: boolean
  valorRecebidoUnetvale: number | null
  dropUsado: number | null
  faixaDrop: string | null
  conectoresUsados: number | null
  condominio: boolean
  subterraneaAereo: string | null
  garantia: boolean
  validada: boolean
  agregada: boolean
  rejeitada: boolean
  agendada: boolean
  trocadoDrop: boolean
  motivoTroca: string | null
  outrasFibras: boolean
  quantasFibras: number | null
  categoriaInterna: string | null
  cat1: string | null
  cat2: string | null
  cat3: string | null
  explicacaoValor: string | null
  observacoes: string | null
  numTecnicos: number | null
  contentHash: string
  clienteUsuario: string | null
  contrato: string | null
}
