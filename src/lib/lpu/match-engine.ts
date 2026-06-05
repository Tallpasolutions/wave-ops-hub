import type {
  ConditionValue,
  LpuRuleNarrowed,
  MatchResult,
  VisitForMatch,
} from "./types";

function matchesCondition(
  condValue: ConditionValue,
  visitValue: unknown,
): boolean {
  if (Array.isArray(condValue)) {
    return (condValue as unknown[]).includes(visitValue);
  }
  if (typeof condValue === "object" && condValue !== null) {
    if (typeof visitValue !== "number") return false;
    const { min, max } = condValue as { min?: number; max?: number };
    if (min !== undefined && visitValue < min) return false;
    if (max !== undefined && visitValue > max) return false;
    return true;
  }
  return condValue === visitValue;
}

function ruleMatchesVisit(
  rule: LpuRuleNarrowed,
  visit: VisitForMatch,
): boolean {
  for (const [key, condValue] of Object.entries(rule.conditions)) {
    const visitValue = visit[key as keyof VisitForMatch];
    if (condValue === undefined) continue;
    if (!matchesCondition(condValue, visitValue)) return false;
  }
  return true;
}

export function findApplicableRule(
  visit: VisitForMatch,
  rules: LpuRuleNarrowed[],
): MatchResult {
  const activeRules = rules.filter((r) => r.ativa);
  const sorted = [...activeRules].sort((a, b) => b.prioridade - a.prioridade);
  const matches = sorted.filter((r) => ruleMatchesVisit(r, visit));

  if (matches.length === 0) return { type: "no_match" };

  const topPriority = matches[0].prioridade;
  const topMatches = matches.filter((r) => r.prioridade === topPriority);
  if (topMatches.length > 1) return { type: "conflict", rules: topMatches };

  return { type: "match", rule: matches[0] };
}
