import {
  calculatePayout,
  calculateDeixadoNaMesa,
} from "@/lib/lpu/calculate-payout";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import { normalizeExplicacao } from "@/lib/etl/explicacao";
import { isDomingoOuFeriado, aplicarAcrescimo } from "./feriado";
import type { DbPayoutStatus, PayoutUpsertData } from "./types";

// ADR-009: finalidades de Cabeamento/Condomínio não têm regra de LPU — o valor vem da
// classificação do gestor por explicacao_valor normalizada. `finalidades` guarda os nomes
// normalizados (trim+lower) do grupo; `map` é explicacao_key → valor.
export type ClassificationCtx = {
  map: Map<string, number>;
  finalidades: Set<string>;
};

// ADR-011: acréscimo de domingo/feriado (config do tenant). `feriados` = datas "YYYY-MM-DD".
export type FeriadoCtx = {
  feriados: Set<string>;
  pct: number;
};

// Regra de improdutiva por receita da Unetvale (valores fixos por ora; troca exige deploy):
//   - Unetvale = R$ 15,98 → improdutiva padrão: Wave repassa R$ 15,00 fixos ao técnico e o
//     payout já sai APROVADO, sem depender da classificação do motivo. Não entra na fila.
//   - Unetvale = R$ 0,00 → a Unetvale não reembolsou (típico de falha do técnico): payout
//     R$ 0,00 e sai da fila automaticamente (decisão de não pagar). Preserva o "deixado na mesa".
//   - Qualquer outra receita → fluxo normal, entra na fila de validação por motivo.
// Comparações em centavos para evitar drift de float.
const UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS = 1598;
const PAYOUT_IMPRODUTIVA_PADRAO = 15.0;

function isImprodutivaPadrao(valorRecebidoUnetvale: number | null): boolean {
  if (valorRecebidoUnetvale === null) return false;
  return Math.round(valorRecebidoUnetvale * 100) === UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS;
}

// Unetvale = R$ 0,00 exato. `null` (receita desconhecida) NÃO conta como zero — cai no fluxo normal.
function isUnetvaleZero(valorRecebidoUnetvale: number | null): boolean {
  if (valorRecebidoUnetvale === null) return false;
  return Math.round(valorRecebidoUnetvale * 100) === 0;
}

// Mapeia o status de 4 valores do match engine para o status de 10 valores do DB.
// O resultado do motor LPU usa "pending" para "regra encontrada e payout calculado".
// No DB, payouts recém-calculados ficam como "pending_review" (aguardando fechamento).
function mapStatus(lpuStatus: "pending" | "no_rule_match" | "conflict" | "pending_classification"): DbPayoutStatus {
  if (lpuStatus === "pending") return "pending_review";
  return lpuStatus;
}

export function buildPayoutUpsert(
  visit: SimVisit,
  rules: LpuRuleNarrowed[],
  reasons: ReasonForPayout[],
  lpuId: string | null,
  tenantId: string,
  classification?: ClassificationCtx,
  feriado?: FeriadoCtx,
  // Salvaguarda de função pura: se já existe decisão manual do gestor para esta visita, as
  // regras automáticas de improdutiva NÃO se aplicam. Na prática o recálculo em lote já protege
  // isso antes (pula payouts com override_by/approved/paid — ver recalculate-batch.ts), então
  // este parâmetro fica em `false`; existe para manter o contrato correto se a função for
  // chamada por outro caminho.
  manualDecisionExists = false,
): PayoutUpsertData {
  // ADR-009: visita com sucesso do grupo Cabeamento/Condomínio → payout vem da
  // classificação (não da LPU). Improdutivas e demais finalidades seguem o fluxo normal.
  const finalidadeKey = visit.finalidade?.trim().toLowerCase();
  const isGrupo = !!finalidadeKey && !!classification?.finalidades.has(finalidadeKey);
  const isSucesso = visit.sucesso.trim().toLowerCase().startsWith("sim");

  // Improdutiva padrão (Unetvale = R$ 15,98): repassa R$ 15,00 fixos e já sai APROVADA,
  // independente da classificação do motivo. Exige técnico mapeado — sem técnico não há a
  // quem pagar, então cai no fluxo normal (o fechamento sinaliza a visita sem técnico).
  if (
    !isSucesso &&
    !manualDecisionExists &&
    visit.tecnicoId &&
    isImprodutivaPadrao(visit.valorRecebidoUnetvale)
  ) {
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: PAYOUT_IMPRODUTIVA_PADRAO,
      valorDeixadoNaMesa: 0,
      status: "approved",
      improdutivaAprovada: true,
    };
  }

  // Improdutiva com Unetvale = R$ 0,00: a Unetvale não reembolsou (típico de falha do técnico).
  // Payout R$ 0,00 e sai da fila (improdutivaAprovada = false = decisão automática de não pagar).
  // Preserva o "deixado na mesa" quando o motivo é falha do técnico, para o relatório.
  if (!isSucesso && !manualDecisionExists && isUnetvaleZero(visit.valorRecebidoUnetvale)) {
    const reason = visit.reasonId ? reasons.find((r) => r.id === visit.reasonId) : undefined;
    const deixadoNaMesa = reason ? calculateDeixadoNaMesa(visit, rules, reason) : 0;
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: 0,
      valorDeixadoNaMesa: deixadoNaMesa,
      status: "pending_review",
      improdutivaAprovada: false,
    };
  }

  // ADR-011: +pct% sobre execução com sucesso em domingo/feriado (não vale p/ improdutiva).
  const aplicaAcrescimo =
    isSucesso && !!feriado && isDomingoOuFeriado(visit.dataExecucao, feriado.feriados);
  const comAcrescimo = (valor: number | null): number | null =>
    valor != null && valor > 0 && aplicaAcrescimo
      ? aplicarAcrescimo(valor, feriado!.pct)
      : valor;

  if (isGrupo && isSucesso) {
    const valor = classification!.map.get(normalizeExplicacao(visit.explicacaoValor));
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: comAcrescimo(valor ?? null),
      valorDeixadoNaMesa: 0,
      status: valor != null ? "pending_review" : "no_rule_match",
      improdutivaAprovada: null,
    };
  }

  const reasonMap = new Map(reasons.map((r) => [r.id, r]));
  const reason = visit.reasonId ? reasonMap.get(visit.reasonId) : undefined;

  const result = calculatePayout(visit, rules, reason);

  let deixadoNaMesa = result.deixadoNaMesa;
  if (reason && result.status === "pending" && result.valor === 0) {
    deixadoNaMesa = calculateDeixadoNaMesa(visit, rules, reason);
  }

  return {
    tenantId,
    visitId: visit.id,
    technicianId: visit.tecnicoId,
    lpuId,
    lpuRuleId: result.ruleId,
    reasonId: visit.reasonId,
    valorCalculado: comAcrescimo(result.valor),
    valorDeixadoNaMesa: deixadoNaMesa,
    status: mapStatus(result.status),
    improdutivaAprovada: null,
  };
}
