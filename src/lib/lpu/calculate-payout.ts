import { findApplicableRule } from "./match-engine";
import type {
  LpuRuleNarrowed,
  PayoutNarrowed,
  PayoutResult,
  ReasonForPayout,
  VisitForMatch,
} from "./types";

export function applyPayoutFormula(
  payout: PayoutNarrowed,
  visit: VisitForMatch,
): number | null {
  switch (payout.type) {
    case "fixed":
      return payout.value;
    case "formula": {
      const fieldValue = visit[payout.additional.field];
      const extra =
        typeof fieldValue === "number"
          ? fieldValue * payout.additional.ratePerUnit
          : 0;
      return payout.base + extra;
    }
    case "percentage_of_revenue":
      if (visit.valorRecebidoUnetvale === null) return null;
      return visit.valorRecebidoUnetvale * (payout.percentage / 100);
  }
}

export function calculateDeixadoNaMesa(
  visit: VisitForMatch,
  rules: LpuRuleNarrowed[],
  reason: ReasonForPayout,
): number {
  if (reason.categoria !== "falha_tecnico") return 0;
  const simulated: VisitForMatch = { ...visit, sucesso: "Sim" };
  const match = findApplicableRule(simulated, rules);
  if (match.type !== "match") return 0;
  return applyPayoutFormula(match.rule.payout, simulated) ?? 0;
}

export function calculatePayout(
  visit: VisitForMatch,
  rules: LpuRuleNarrowed[],
  reason: ReasonForPayout | null | undefined,
): PayoutResult {
  const noLeave = { deixadoNaMesa: 0 };

  if (visit.sucesso === "Sim") {
    const match = findApplicableRule(visit, rules);
    if (match.type === "no_match")
      return { valor: null, ruleId: null, status: "no_rule_match", ...noLeave };
    if (match.type === "conflict")
      return { valor: null, ruleId: null, status: "conflict", ...noLeave };
    return {
      valor: applyPayoutFormula(match.rule.payout, visit),
      ruleId: match.rule.id,
      status: "pending",
      ...noLeave,
    };
  }

  if (!reason || reason.categoria === "pendente_classificacao") {
    return {
      valor: null,
      ruleId: null,
      status: "pending_classification",
      ...noLeave,
    };
  }

  if (!reason.pagaImprodutiva) {
    const deixadoNaMesa = calculateDeixadoNaMesa(visit, rules, reason);
    return { valor: 0, ruleId: null, status: "pending", deixadoNaMesa };
  }

  if (reason.valorImprodutiva !== null) {
    return {
      valor: reason.valorImprodutiva,
      ruleId: null,
      status: "pending",
      ...noLeave,
    };
  }

  const visitImprodutiva: VisitForMatch = { ...visit, sucesso: "Improdutiva" };
  const match = findApplicableRule(visitImprodutiva, rules);
  if (match.type === "no_match")
    return { valor: null, ruleId: null, status: "no_rule_match", ...noLeave };
  if (match.type === "conflict")
    return { valor: null, ruleId: null, status: "conflict", ...noLeave };
  return {
    valor: applyPayoutFormula(match.rule.payout, visit),
    ruleId: match.rule.id,
    status: "pending",
    ...noLeave,
  };
}
