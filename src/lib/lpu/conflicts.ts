import type { ConflictGroup, LpuRuleNarrowed } from "./types";

export function detectConflicts(rules: LpuRuleNarrowed[]): ConflictGroup[] {
  const activeRules = rules.filter((r) => r.ativa);
  const byPriority = activeRules.reduce(
    (acc, rule) => {
      const group = acc.get(rule.prioridade) ?? [];
      group.push(rule);
      return acc.set(rule.prioridade, group);
    },
    new Map<number, LpuRuleNarrowed[]>(),
  );

  return [...byPriority.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([prioridade, ruleGroup]) => ({ prioridade, rules: ruleGroup }))
    .sort((a, b) => b.prioridade - a.prioridade);
}
