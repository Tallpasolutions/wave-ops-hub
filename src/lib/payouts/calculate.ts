import {
  calculatePayout,
  calculateDeixadoNaMesa,
} from "@/lib/lpu/calculate-payout";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import type { DbPayoutStatus, PayoutUpsertData } from "./types";

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
): PayoutUpsertData {
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
