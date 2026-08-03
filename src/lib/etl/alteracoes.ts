import type { SupabaseClient } from '@supabase/supabase-js'

// ADR-021: a Unetvale altera o valor de uma OS depois de já ter informado outro. Quando isso
// acontece por abertura de OS de garantia, ela reduz a receita da Wave e ninguém fica sabendo —
// a planilha nova sobrescreve a antiga em silêncio.
//
// O gatilho tem duas partes:
//   1. FATO OBJETIVO — a receita mudou entre duas ingestões. Vem de `service_visits_audit`, que
//      o trigger `trg_audit_visits` popula em todo UPDATE de visita desde a migration 0001.
//   2. CLASSIFICAÇÃO — separar garantia dos outros motivos de alteração (outro técnico fechou a
//      OS, improdutiva invalidada), que estão fora do escopo por decisão da Wave (03/08/2026).
//
// A parte 2 depende do texto livre da observação, e isso é frágil: se a Unetvale mudar a redação,
// a detecção para em silêncio. Daí a segunda trava — a assinatura numérica de −R$ 60,50, que é a
// redução nos quatro casos reais levantados em produção. Texto OU assinatura registra.

// Redução fixa que a Unetvale aplica ao abrir OS de garantia (4/4 casos em 03/08/2026).
const REDUCAO_GARANTIA_CENTAVOS = -6050

const PADRAO_GARANTIA = 'abertura da os de garantia'

// Remove acentos para o casamento do texto não depender de como a Unetvale acentua.
// `̀-ͯ` é o bloco de diacríticos combinantes que o NFD separa das letras.
const DIACRITICOS = /[\u0300-\u036f]/g

function semAcento(s: string): string {
  return s.normalize('NFD').replace(DIACRITICOS, '')
}

/**
 * Decide se uma alteração de receita foi causada por abertura de OS de garantia.
 *
 * Casa por texto da observação da Unetvale OU pela assinatura numérica da redução. `null` em
 * qualquer um dos valores não conta como alteração — receita desconhecida não é zero, mesma
 * convenção do motor de payout.
 */
export function isAlteracaoGarantia(
  observacao: string | null | undefined,
  receitaAnterior: number | null,
  receitaNova: number | null,
): boolean {
  if (receitaAnterior === null || receitaNova === null) return false
  if (Math.round(receitaAnterior * 100) === Math.round(receitaNova * 100)) return false

  const texto = semAcento((observacao ?? '').toLowerCase())
  if (texto.includes(PADRAO_GARANTIA)) return true

  const variacao = Math.round(receitaNova * 100) - Math.round(receitaAnterior * 100)
  return variacao === REDUCAO_GARANTIA_CENTAVOS
}

export type AlteracaoDetectada = {
  visitId: string
  osNum: number
  technicianId: string | null
  receitaAnterior: number
  receitaNova: number
  payoutAnterior: number | null
}

export type DeteccaoResult = {
  alteracoes: AlteracaoDetectada[]
  /**
   * Alterações de receita no mesmo upload que NÃO casaram garantia. Não viram registro (estão
   * fora do escopo), mas entram no corpo da notificação do gestor — sem isso, uma mudança de
   * redação da Unetvale faria a funcionalidade morrer sem ninguém perceber.
   */
  naoClassificadas: number
}

type AuditRow = {
  visit_id: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Lê a auditoria das visitas escritas por este upload e registra as alterações de garantia.
 *
 * Roda ANTES do recálculo, para o snapshot de `payout_anterior` refletir o que o técnico via.
 */
export async function detectarAlteracoesGarantia(
  uploadId: string,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<DeteccaoResult> {
  const vazio: DeteccaoResult = { alteracoes: [], naoClassificadas: 0 }

  const { data: auditRaw, error: auditError } = await supabase
    .from('service_visits_audit')
    .select('visit_id, before, after')
    .eq('upload_id', uploadId)

  if (auditError) {
    console.error('[detectarAlteracoesGarantia] auditoria', auditError)
    return vazio
  }

  const rows = (auditRaw ?? []) as AuditRow[]
  const candidatas: {
    visitId: string
    observacao: string | null
    receitaAnterior: number
    receitaNova: number
  }[] = []
  let naoClassificadas = 0

  for (const r of rows) {
    const anterior = toNum(r.before?.valor_recebido_unetvale)
    const nova = toNum(r.after?.valor_recebido_unetvale)
    if (anterior === null || nova === null) continue
    if (Math.round(anterior * 100) === Math.round(nova * 100)) continue

    const observacao = (r.after?.observacoes as string | null) ?? null
    if (isAlteracaoGarantia(observacao, anterior, nova)) {
      candidatas.push({ visitId: r.visit_id, observacao, receitaAnterior: anterior, receitaNova: nova })
    } else {
      naoClassificadas++
    }
  }

  if (candidatas.length === 0) return { alteracoes: [], naoClassificadas }

  const visitIds = candidatas.map((c) => c.visitId)
  const { data: visitsRaw, error: visitsError } = await supabase
    .from('service_visits')
    .select('id, os_num, tecnico_id, payouts(valor_calculado, valor_override)')
    .in('id', visitIds)

  if (visitsError) {
    console.error('[detectarAlteracoesGarantia] visitas', visitsError)
    return vazio
  }

  type VisitRow = {
    id: string
    os_num: number
    tecnico_id: string | null
    payouts: { valor_calculado: number | string | null; valor_override: number | string | null } | null
  }
  // `payouts` chega como OBJETO, não array: `payouts.visit_id` é UNIQUE, então o PostgREST
  // resolve o embed como to-one. Os tipos gerados assumem array — daí o cast.
  const visits = (visitsRaw ?? []) as unknown as VisitRow[]
  const byId = new Map(visits.map((v) => [v.id, v]))

  const alteracoes: AlteracaoDetectada[] = []
  for (const c of candidatas) {
    const v = byId.get(c.visitId)
    if (!v) continue
    const p = v.payouts
    const payoutAnterior = p ? toNum(p.valor_override ?? p.valor_calculado) : null
    alteracoes.push({
      visitId: c.visitId,
      osNum: Number(v.os_num),
      technicianId: v.tecnico_id,
      receitaAnterior: c.receitaAnterior,
      receitaNova: c.receitaNova,
      payoutAnterior,
    })
  }

  const { error: insertError } = await supabase.from('unetvale_alteracoes').upsert(
    alteracoes.map((a) => {
      const obs = candidatas.find((c) => c.visitId === a.visitId)?.observacao ?? null
      return {
        tenant_id: tenantId,
        visit_id: a.visitId,
        os_num: a.osNum,
        technician_id: a.technicianId,
        upload_id: uploadId,
        observacao_unetvale: obs,
        receita_anterior: a.receitaAnterior,
        receita_nova: a.receitaNova,
        payout_anterior: a.payoutAnterior,
      }
    }),
    { onConflict: 'visit_id,upload_id,receita_anterior,receita_nova', ignoreDuplicates: true },
  )

  if (insertError) {
    console.error('[detectarAlteracoesGarantia] insert', insertError)
    return vazio
  }

  return { alteracoes, naoClassificadas }
}

export type AlteracaoFinalizada = AlteracaoDetectada & { payoutNovo: number | null }

/**
 * Depois do recálculo: grava `payout_novo` e devolve o que virou notificação.
 *
 * Só as alterações deste upload — reprocessar não renotifica alteração antiga.
 */
export async function finalizarAlteracoes(
  uploadId: string,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<AlteracaoFinalizada[]> {
  const { data: registros, error } = await supabase
    .from('unetvale_alteracoes')
    .select(
      'id, visit_id, os_num, technician_id, receita_anterior, receita_nova, payout_anterior, service_visits(payouts(valor_calculado, valor_override))',
    )
    .eq('tenant_id', tenantId)
    .eq('upload_id', uploadId)

  if (error) {
    console.error('[finalizarAlteracoes] leitura', error)
    return []
  }

  type Registro = {
    id: string
    visit_id: string
    os_num: number
    technician_id: string | null
    receita_anterior: number | string | null
    receita_nova: number | string | null
    payout_anterior: number | string | null
    service_visits: {
      payouts: { valor_calculado: number | string | null; valor_override: number | string | null } | null
    } | null
  }

  // Mesmo motivo do cast acima: os embeds to-one chegam como objeto em runtime.
  const out: AlteracaoFinalizada[] = []
  for (const r of (registros ?? []) as unknown as Registro[]) {
    const p = r.service_visits?.payouts ?? null
    const payoutNovo = p ? toNum(p.valor_override ?? p.valor_calculado) : null
    const { error: updError } = await supabase
      .from('unetvale_alteracoes')
      .update({ payout_novo: payoutNovo })
      .eq('id', r.id)
    if (updError) console.error('[finalizarAlteracoes] update', updError)

    out.push({
      visitId: r.visit_id,
      osNum: Number(r.os_num),
      technicianId: r.technician_id,
      receitaAnterior: toNum(r.receita_anterior) ?? 0,
      receitaNova: toNum(r.receita_nova) ?? 0,
      payoutAnterior: toNum(r.payout_anterior),
      payoutNovo,
    })
  }
  return out
}

/** O pagamento do técnico mudou de fato? É o que decide se ele é notificado. */
export function payoutMudou(a: AlteracaoFinalizada): boolean {
  const antes = a.payoutAnterior === null ? null : Math.round(a.payoutAnterior * 100)
  const depois = a.payoutNovo === null ? null : Math.round(a.payoutNovo * 100)
  return antes !== depois
}
