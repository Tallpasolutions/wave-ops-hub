import {
  calculatePayout,
  calculateDeixadoNaMesa,
} from "@/lib/lpu/calculate-payout";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import { normalizeExplicacao } from "@/lib/etl/explicacao";
import type { DbPayoutStatus, PayoutUpsertData } from "./types";

// ADR-009: finalidades de Cabeamento/Condomínio não têm regra de LPU — o valor vem da
// classificação do gestor por explicacao_valor normalizada. `finalidades` guarda os nomes
// normalizados (trim+lower) do grupo; `map` é explicacao_key → valor.
export type ClassificationCtx = {
  map: Map<string, number>;
  finalidades: Set<string>;
};

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
): PayoutUpsertData {
  // ADR-009: visita com sucesso do grupo Cabeamento/Condomínio → payout vem da
  // classificação (não da LPU). Improdutivas e demais finalidades seguem o fluxo normal.
  const finalidadeKey = visit.finalidade?.trim().toLowerCase();
  const isGrupo = !!finalidadeKey && !!classification?.finalidades.has(finalidadeKey);
  const isSucesso = visit.sucesso.trim().toLowerCase().startsWith("sim");
  if (isGrupo && isSucesso) {
    const valor = classification!.map.get(normalizeExplicacao(visit.explicacaoValor));
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: valor ?? null,
      valorDeixadoNaMesa: 0,
      status: valor != null ? "pending_review" : "no_rule_match",
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
    valorCalculado: result.valor,
    valorDeixadoNaMesa: deixadoNaMesa,
    status: mapStatus(result.status),
  };
}
