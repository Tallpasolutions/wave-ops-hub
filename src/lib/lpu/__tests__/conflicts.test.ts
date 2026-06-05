import { describe, expect, it } from "vitest";
import { detectConflicts } from "../conflicts";
import type { LpuRuleNarrowed } from "../types";

function makeRule(
  id: string,
  prioridade: number,
  ativa = true,
): LpuRuleNarrowed {
  return {
    id,
    lpuId: "lpu-1",
    prioridade,
    conditions: { sucesso: "Sim" },
    payout: { type: "fixed", value: 80 },
    description: `Regra ${id}`,
    ativa,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("detectConflicts", () => {
  it("retorna vazio quando nenhuma regra tem mesma prioridade", () => {
    const rules = [makeRule("r1", 100), makeRule("r2", 200)];
    expect(detectConflicts(rules)).toEqual([]);
  });

  it("retorna um ConflictGroup quando duas regras têm prioridade 200", () => {
    const rules = [makeRule("r1", 200), makeRule("r2", 200), makeRule("r3", 100)];
    const conflicts = detectConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].prioridade).toBe(200);
    expect(conflicts[0].rules).toHaveLength(2);
  });

  it("regras inativas não são consideradas conflito", () => {
    const rules = [makeRule("r1", 200), makeRule("r2", 200, false)];
    expect(detectConflicts(rules)).toEqual([]);
  });
});
