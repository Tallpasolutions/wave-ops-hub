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

  it("regras com agregada mutuamente exclusiva na mesma prioridade não são conflito", () => {
    const base = { lpuId: "lpu-1", payout: { type: "fixed" as const, value: 120 }, ativa: true, createdAt: new Date(), updatedAt: new Date() };
    const ruleA: LpuRuleNarrowed = { ...base, id: "r1", description: "Suporte sem venda", prioridade: 400, conditions: { finalidade: ["Suporte Fibra"], subterraneaAereo: "Aéreo", tipoAtendimento: "Externo", agregada: false } };
    const ruleB: LpuRuleNarrowed = { ...base, id: "r2", description: "Suporte com venda", prioridade: 400, conditions: { finalidade: ["Suporte Fibra"], subterraneaAereo: "Aéreo", tipoAtendimento: "Externo", agregada: true } };
    expect(detectConflicts([ruleA, ruleB])).toEqual([]);
  });

  it("detecta conflito real quando condições se sobrepõem na mesma prioridade", () => {
    const base = { lpuId: "lpu-1", payout: { type: "fixed" as const, value: 120 }, ativa: true, createdAt: new Date(), updatedAt: new Date() };
    const ruleA: LpuRuleNarrowed = { ...base, id: "r1", description: "Regra A", prioridade: 300, conditions: { finalidade: "Suporte Fibra", subterraneaAereo: "Aéreo" } };
    const ruleB: LpuRuleNarrowed = { ...base, id: "r2", description: "Regra B", prioridade: 300, conditions: { finalidade: "Suporte Fibra", tipoAtendimento: "Externo" } };
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rules).toHaveLength(2);
  });
});
