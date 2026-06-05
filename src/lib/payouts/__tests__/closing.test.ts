import { describe, expect, it } from "vitest";
import { validateClosingReadiness, buildClosingTotals } from "../closing";
import type { PayoutForClosing } from "../types";

function makePayout(overrides: Partial<PayoutForClosing> = {}): PayoutForClosing {
  return {
    id: "payout-1",
    status: "pending_review",
    valorCalculado: "80.00",
    valorOverride: null,
    ...overrides,
  };
}

describe("validateClosingReadiness", () => {
  it("sem bloqueadores → valid: true", () => {
    const payouts = [
      makePayout({ status: "pending_review" }),
      makePayout({ id: "payout-2", status: "override" }),
    ];
    const result = validateClosingReadiness(payouts, 0);
    expect(result.valid).toBe(true);
  });

  it("no_rule_match presente → valid: false com contador correto", () => {
    const payouts = [
      makePayout({ status: "no_rule_match" }),
      makePayout({ id: "p2", status: "no_rule_match" }),
      makePayout({ id: "p3", status: "pending_review" }),
    ];
    const result = validateClosingReadiness(payouts, 0);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.blockers.noRuleMatch).toBe(2);
      expect(result.blockers.conflict).toBe(0);
      expect(result.blockers.pendingClassification).toBe(0);
    }
  });

  it("visitas sem técnico → valid: false com semTecnico", () => {
    const result = validateClosingReadiness([], 3);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.blockers.semTecnico).toBe(3);
  });

  it("múltiplos bloqueadores simultâneos → todos contabilizados", () => {
    const payouts = [
      makePayout({ status: "no_rule_match" }),
      makePayout({ id: "p2", status: "conflict" }),
      makePayout({ id: "p3", status: "pending_classification" }),
    ];
    const result = validateClosingReadiness(payouts, 2);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.blockers.noRuleMatch).toBe(1);
      expect(result.blockers.conflict).toBe(1);
      expect(result.blockers.pendingClassification).toBe(1);
      expect(result.blockers.semTecnico).toBe(2);
    }
  });
});

describe("buildClosingTotals", () => {
  it("soma valor efetivo = override se houver, senão calculado", () => {
    const payouts = [
      makePayout({ valorCalculado: "80.00", valorOverride: null }),
      makePayout({ id: "p2", valorCalculado: "60.00", valorOverride: "50.00" }),
    ];
    const result = buildClosingTotals(payouts, [200, 150]);
    expect(result.totalAPagar).toBe(130); // 80 + 50
    expect(result.totalReceitaUnetvale).toBe(350);
    expect(result.margem).toBe(220);
    expect(result.totalVisitas).toBe(2);
  });

  it("payouts bloqueados (no_rule_match) são excluídos do total a pagar", () => {
    const payouts = [
      makePayout({ valorCalculado: "80.00" }),
      makePayout({ id: "p2", status: "no_rule_match", valorCalculado: null }),
    ];
    const result = buildClosingTotals(payouts, [200, 0]);
    expect(result.totalAPagar).toBe(80);
    expect(result.totalVisitas).toBe(2);
  });

  it("lista vazia → zeros", () => {
    const result = buildClosingTotals([], []);
    expect(result.totalAPagar).toBe(0);
    expect(result.margem).toBe(0);
  });
});
