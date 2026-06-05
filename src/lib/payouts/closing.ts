import type {
  ClosingValidation,
  ClosingTotals,
  DbPayoutStatus,
  PayoutForClosing,
} from "./types";

const BLOCKING_STATUSES: DbPayoutStatus[] = [
  "no_rule_match",
  "pending_classification",
  "conflict",
];

export function validateClosingReadiness(
  payouts: PayoutForClosing[],
  visitsWithoutTechnician: number,
): ClosingValidation {
  const noRuleMatch = payouts.filter(
    (p) => p.status === "no_rule_match",
  ).length;
  const pendingClassification = payouts.filter(
    (p) => p.status === "pending_classification",
  ).length;
  const conflict = payouts.filter((p) => p.status === "conflict").length;

  const hasBlockers =
    noRuleMatch > 0 ||
    pendingClassification > 0 ||
    conflict > 0 ||
    visitsWithoutTechnician > 0;

  if (!hasBlockers) return { valid: true };

  return {
    valid: false,
    blockers: {
      noRuleMatch,
      pendingClassification,
      conflict,
      semTecnico: visitsWithoutTechnician,
    },
  };
}

export function buildClosingTotals(
  payouts: PayoutForClosing[],
  receitasPorVisita: number[],
): ClosingTotals {
  const included = payouts.filter(
    (p) => !BLOCKING_STATUSES.includes(p.status),
  );

  const totalAPagar = included.reduce((acc, p) => {
    const efetivo =
      p.valorOverride !== null ? Number(p.valorOverride) : Number(p.valorCalculado ?? 0);
    return acc + efetivo;
  }, 0);

  const totalReceitaUnetvale = receitasPorVisita.reduce((a, b) => a + b, 0);
  const margem = totalReceitaUnetvale - totalAPagar;

  return {
    totalAPagar,
    totalReceitaUnetvale,
    margem,
    totalVisitas: payouts.length,
  };
}

export { BLOCKING_STATUSES };
