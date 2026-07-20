// Tipos do domínio de coleta do IQI (ADR-012).

/**
 * Resposta crua do endpoint /index/iqi da Unetvale — config Highcharts.
 * Modelamos só o que consumimos; o resto do payload é ignorado.
 */
export interface IqiRawResponse {
  xAxis?: { categories?: string[] }
  series?: IqiRawSeries[]
}

export interface IqiRawSeries {
  name?: string
  type?: string
  data?: Array<number | null>
  /** Números de OS por mês (presente nas séries de coluna). */
  oss?: number[][]
}

/** Um mês normalizado do IQI de um técnico. */
export interface IqiMonthly {
  /** Competência no formato "AAAA-MM". */
  competencia: string
  /** Total de OS's produtivas no mês. */
  totalOs: number
  /** Contratos com atendimento reincidente no mês. */
  contratosReincidentes: number
  /** IQI: contratosReincidentes / totalOs * 100, arredondado a 2 casas. */
  pctReincidencia: number
  /** Drilldown: números de OS do mês (total e reincidentes). */
  osNums: { total: number[]; reincidentes: number[] }
}

/** Resultado de uma execução de coleta, para logging/telemetria. */
export interface IqiCollectionResult {
  tecnicosProcessados: number
  mesesGravados: number
  semCodigoUnetvale: string[]
  erros: Array<{ tecnico: string; erro: string }>
}
