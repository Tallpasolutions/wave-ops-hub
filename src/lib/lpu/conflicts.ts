import type { ConflictGroup, ConditionValue, LpuRuleNarrowed } from "./types";

function valuesAreMutuallyExclusive(a: ConditionValue, b: ConditionValue): boolean {
  if (typeof a === "boolean" && typeof b === "boolean") return a !== b;
  if (typeof a === "string" && typeof b === "string") return a !== b;
  if (typeof a === "number" && typeof b === "number") return a !== b;
  if (Array.isArray(a) && Array.isArray(b))
    return !a.some((v) => (b as unknown[]).includes(v));
  if (Array.isArray(a) && !Array.isArray(b))
    return !(a as unknown[]).includes(b);
  if (!Array.isArray(a) && Array.isArray(b))
    return !(b as unknown[]).includes(a);
  return false;
}

function rulesCanConflict(
  ruleA: LpuRuleNarrowed,
  ruleB: LpuRuleNarrowed,
): boolean {
  for (const key of Object.keys(ruleA.conditions)) {
    if (!(key in ruleB.conditions)) continue;
    const valA = ruleA.conditions[key as keyof typeof ruleA.conditions];
    const valB = ruleB.conditions[key as keyof typeof ruleB.conditions];
    if (valA !== undefined && valB !== undefined && valuesAreMutuallyExclusive(valA, valB)) {
      return false;
    }
  }
  return true;
}

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

  const result: ConflictGroup[] = [];

  for (const [prioridade, group] of byPriority) {
    if (group.length <= 1) continue;

    const conflicting: LpuRuleNarrowed[] = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (rulesCanConflict(group[i], group[j])) {
          if (!conflicting.includes(group[i])) conflicting.push(group[i]);
          if (!conflicting.includes(group[j])) conflicting.push(group[j]);
        }
      }
    }

    if (conflicting.length > 0) {
      result.push({ prioridade, rules: conflicting });
    }
  }

  return result.sort((a, b) => b.prioridade - a.prioridade);
}
