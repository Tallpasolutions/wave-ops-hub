export type VisitRow = {
  os_num: number | null
  data_execucao: string | null
  tecnico_id: string | null
  finalidade: string | null
  tipo_atendimento: string | null
  sucesso: string | null
  improdutiva: boolean | null
  rejeitada: boolean | null
  valor_recebido_unetvale: number | null
  cidade: string | null
  reason_id: string | null
}

export type TechRow = { id: string; nome_completo: string }
export type ReasonRow = { id: string; motivo_normalizado: string | null; categoria: string | null }

export type DashKpis = {
  totalVisitas: number
  mediaDiaria: number
  totalArrecadacao: number
  arrecadacaoPorDia: number
  ticketMedio: number
  taxaFinalizacao: number
  totalFinalizadas: number
  improdutividade: number
  totalImprodutivas: number
  equipeAtiva: number
  cidadesAtendidas: number
  totalRejeitadas: number
}

export type DailyPoint = { dia: string; qtd: number; valor: number }

export type FinalidadeRow = {
  nome: string
  qtd: number
  valorTotal: number
  valorMedio: number
  finalizadas: number
  taxa: number
}

export type TipoAtendimentoRow = { tipo: string; qtd: number; valor: number }

export type TecnicoRow = {
  id: string | null
  nome: string
  totalOs: number
  valorTotal: number
  valorMedio: number
  finalizadas: number
  naoFinalizadas: number
  improdutivas: number
  taxaSucesso: number
}

export type CidadeRow = { nome: string; qtd: number; valor: number }

export type MotivoRow = { nome: string; categoria: string; qtd: number }

export type DashboardAgg = {
  kpis: DashKpis
  volumeDiario: DailyPoint[]
  porFinalidade: FinalidadeRow[]
  porTipoAtendimento: TipoAtendimentoRow[]
  porTecnico: TecnicoRow[]
  porCidade: CidadeRow[]
  porMotivo: MotivoRow[]
}

function sum(arr: (number | null | undefined)[]): number {
  return arr.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

export function aggregate(
  visits: VisitRow[],
  techs: TechRow[],
  reasons: ReasonRow[],
  daysInPeriod: number,
): DashboardAgg {
  const techMap = new Map(techs.map((t) => [t.id, t.nome_completo]))
  const reasonMap = new Map(reasons.map((r) => [r.id, r]))

  const totalVisitas = visits.length
  const totalArrecadacao = sum(visits.map((v) => v.valor_recebido_unetvale))
  const isSuccess = (v: VisitRow) => v.sucesso?.trim().toLowerCase().startsWith('sim') ?? false
  const finalizadas = visits.filter(isSuccess)
  const improdutivas = visits.filter((v) => v.improdutiva === true)
  const rejeitadas = visits.filter((v) => v.rejeitada === true)
  const techIds = new Set(visits.filter((v) => v.tecnico_id).map((v) => v.tecnico_id))
  const cidades = new Set(visits.filter((v) => v.cidade).map((v) => v.cidade))

  const kpis: DashKpis = {
    totalVisitas,
    mediaDiaria: daysInPeriod > 0 ? totalVisitas / daysInPeriod : 0,
    totalArrecadacao,
    arrecadacaoPorDia: daysInPeriod > 0 ? totalArrecadacao / daysInPeriod : 0,
    ticketMedio: finalizadas.length > 0 ? sum(finalizadas.map((v) => v.valor_recebido_unetvale)) / finalizadas.length : 0,
    taxaFinalizacao: totalVisitas > 0 ? (finalizadas.length / totalVisitas) * 100 : 0,
    totalFinalizadas: finalizadas.length,
    improdutividade: totalVisitas > 0 ? (improdutivas.length / totalVisitas) * 100 : 0,
    totalImprodutivas: improdutivas.length,
    equipeAtiva: techIds.size,
    cidadesAtendidas: cidades.size,
    totalRejeitadas: rejeitadas.length,
  }

  // Daily volume
  const dailyMap = new Map<string, { qtd: number; valor: number }>()
  for (const v of visits) {
    if (!v.data_execucao) continue
    const dia = v.data_execucao.slice(0, 10)
    const cur = dailyMap.get(dia) ?? { qtd: 0, valor: 0 }
    cur.qtd += 1
    cur.valor += v.valor_recebido_unetvale ?? 0
    dailyMap.set(dia, cur)
  }
  const volumeDiario: DailyPoint[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, d]) => ({ dia: dia.slice(8, 10), qtd: d.qtd, valor: d.valor }))

  // By finalidade
  const finalMap = new Map<string, { qtd: number; valorTotal: number; finalizadas: number }>()
  for (const v of visits) {
    const nome = v.finalidade ?? 'Sem categoria'
    const cur = finalMap.get(nome) ?? { qtd: 0, valorTotal: 0, finalizadas: 0 }
    cur.qtd += 1
    cur.valorTotal += v.valor_recebido_unetvale ?? 0
    if (isSuccess(v)) cur.finalizadas += 1
    finalMap.set(nome, cur)
  }
  const porFinalidade: FinalidadeRow[] = [...finalMap.entries()]
    .map(([nome, d]) => ({
      nome,
      qtd: d.qtd,
      valorTotal: d.valorTotal,
      valorMedio: d.qtd > 0 ? d.valorTotal / d.qtd : 0,
      finalizadas: d.finalizadas,
      taxa: d.qtd > 0 ? (d.finalizadas / d.qtd) * 100 : 0,
    }))
    .sort((a, b) => b.qtd - a.qtd)

  // By tipo atendimento
  const tipoMap = new Map<string, { qtd: number; valor: number }>()
  for (const v of visits) {
    const tipo = v.tipo_atendimento ?? 'Outros'
    const cur = tipoMap.get(tipo) ?? { qtd: 0, valor: 0 }
    cur.qtd += 1
    cur.valor += v.valor_recebido_unetvale ?? 0
    tipoMap.set(tipo, cur)
  }
  const porTipoAtendimento: TipoAtendimentoRow[] = [...tipoMap.entries()]
    .map(([tipo, d]) => ({ tipo, qtd: d.qtd, valor: d.valor }))
    .sort((a, b) => b.qtd - a.qtd)

  // By technician
  const tecMap2 = new Map<
    string | null,
    { nome: string; totalOs: number; valorTotal: number; finalizadas: number; naoFinalizadas: number; improdutivas: number }
  >()
  for (const v of visits) {
    const key = v.tecnico_id ?? null
    const nome = key ? (techMap.get(key) ?? 'Técnico desconhecido') : 'Não vinculado'
    const cur = tecMap2.get(key) ?? { nome, totalOs: 0, valorTotal: 0, finalizadas: 0, naoFinalizadas: 0, improdutivas: 0 }
    cur.totalOs += 1
    cur.valorTotal += v.valor_recebido_unetvale ?? 0
    if (isSuccess(v)) cur.finalizadas += 1
    else cur.naoFinalizadas += 1
    if (v.improdutiva === true) cur.improdutivas += 1
    tecMap2.set(key, cur)
  }
  const porTecnico: TecnicoRow[] = [...tecMap2.entries()]
    .map(([id, d]) => ({
      id,
      nome: d.nome,
      totalOs: d.totalOs,
      valorTotal: d.valorTotal,
      valorMedio: d.totalOs > 0 ? d.valorTotal / d.totalOs : 0,
      finalizadas: d.finalizadas,
      naoFinalizadas: d.naoFinalizadas,
      improdutivas: d.improdutivas,
      taxaSucesso: d.totalOs > 0 ? (d.finalizadas / d.totalOs) * 100 : 0,
    }))
    .sort((a, b) => b.totalOs - a.totalOs)

  // By city
  const cidMap = new Map<string, { qtd: number; valor: number }>()
  for (const v of visits) {
    const nome = v.cidade ?? 'Sem cidade'
    const cur = cidMap.get(nome) ?? { qtd: 0, valor: 0 }
    cur.qtd += 1
    cur.valor += v.valor_recebido_unetvale ?? 0
    cidMap.set(nome, cur)
  }
  const porCidade: CidadeRow[] = [...cidMap.entries()]
    .map(([nome, d]) => ({ nome, qtd: d.qtd, valor: d.valor }))
    .sort((a, b) => b.qtd - a.qtd)

  // By reason (only non-finalizadas)
  const motMap = new Map<string, { nome: string; categoria: string; qtd: number }>()
  for (const v of visits) {
    if (isSuccess(v)) continue
    if (!v.reason_id) continue
    const r = reasonMap.get(v.reason_id)
    if (!r) continue
    const nome = r.motivo_normalizado ?? 'Motivo desconhecido'
    const cur = motMap.get(v.reason_id) ?? { nome, categoria: r.categoria ?? 'pendente_classificacao', qtd: 0 }
    cur.qtd += 1
    motMap.set(v.reason_id, cur)
  }
  const porMotivo: MotivoRow[] = [...motMap.values()]
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 8)

  return { kpis, volumeDiario, porFinalidade, porTipoAtendimento, porTecnico, porCidade, porMotivo }
}
