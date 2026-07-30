import { describe, expect, it } from "vitest";
import { findApplicableRule } from "../match-engine";
import type { LpuRuleNarrowed, VisitForMatch } from "../types";

const BASE_VISIT: VisitForMatch = {
  finalidade: "Suporte Fibra",
  tipoAtendimento: "Externo",
  sucesso: "Sim",
  cidade: "São Paulo",
  condominio: false,
  dropUsado: 30,
  faixaDrop: "0-50",
  conectoresUsados: 2,
  garantia: false,
  subterraneaAereo: null,
  valorRecebidoUnetvale: 206.26,
  tecnicoId: null,
  agregada: false,
};

function makeRule(
  overrides: Partial<LpuRuleNarrowed> = {},
): LpuRuleNarrowed {
  return {
    id: "rule-1",
    lpuId: "lpu-1",
    prioridade: 100,
    conditions: { finalidade: "Suporte Fibra" },
    payout: { type: "fixed", value: 80 },
    description: "Regra base",
    ativa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("findApplicableRule", () => {
  it("casa com regra de condição exata", () => {
    const rule = makeRule({ conditions: { finalidade: "Suporte Fibra" } });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "match", rule });
  });

  it("casa quando visita.cidade está em array de strings", () => {
    const rule = makeRule({
      conditions: { cidade: ["São Paulo", "Campinas"] },
    });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "match", rule });
  });

  it("casa com range numérico quando dropUsado = 30 (max 50)", () => {
    const rule = makeRule({ conditions: { dropUsado: { max: 50 } } });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "match", rule });
  });

  it("não casa com range quando dropUsado = 30 e min = 50", () => {
    const rule = makeRule({ conditions: { dropUsado: { min: 50 } } });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "no_match" });
  });

  it("não casa quando condição difere da visita", () => {
    const rule = makeRule({ conditions: { finalidade: "Instalação" } });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "no_match" });
  });

  it("retorna conflict quando duas regras com mesma prioridade casam", () => {
    const rule1 = makeRule({ id: "r1", prioridade: 100, conditions: { sucesso: "Sim" } });
    const rule2 = makeRule({ id: "r2", prioridade: 100, conditions: { sucesso: "Sim" } });
    const result = findApplicableRule(BASE_VISIT, [rule1, rule2]);
    expect(result.type).toBe("conflict");
  });

  it("retorna no_match quando nenhuma regra está ativa", () => {
    const rule = makeRule({ ativa: false });
    const result = findApplicableRule(BASE_VISIT, [rule]);
    expect(result).toEqual({ type: "no_match" });
  });

  it("regra com tecnicoId só bate para esse técnico", () => {
    const visitaTecA: VisitForMatch = { ...BASE_VISIT, tecnicoId: "tec-a" };
    const rule = makeRule({ conditions: { finalidade: "Suporte Fibra", tecnicoId: "tec-a" }, prioridade: 200 });
    expect(findApplicableRule(visitaTecA, [rule]).type).toBe("match");
    const visitaTecB: VisitForMatch = { ...BASE_VISIT, tecnicoId: "tec-b" };
    expect(findApplicableRule(visitaTecB, [rule]).type).toBe("no_match");
  });

  it("fallback para regra geral quando técnico não tem regra específica", () => {
    const visitaTecB: VisitForMatch = { ...BASE_VISIT, tecnicoId: "tec-b" };
    const ruleGeral = makeRule({ id: "geral", prioridade: 100, conditions: { finalidade: "Suporte Fibra" } });
    const ruleEspecifica = makeRule({ id: "esp", prioridade: 200, conditions: { finalidade: "Suporte Fibra", tecnicoId: "tec-a" } });
    const result = findApplicableRule(visitaTecB, [ruleGeral, ruleEspecifica]);
    expect(result).toEqual({ type: "match", rule: ruleGeral });
  });

  it("regra específica por técnico supera regra geral por prioridade", () => {
    const visitaTecA: VisitForMatch = { ...BASE_VISIT, tecnicoId: "tec-a" };
    const ruleGeral = makeRule({ id: "geral", prioridade: 100, conditions: { finalidade: "Suporte Fibra" }, payout: { type: "fixed", value: 80 } });
    const ruleEspecifica = makeRule({ id: "esp", prioridade: 200, conditions: { finalidade: "Suporte Fibra", tecnicoId: "tec-a" }, payout: { type: "fixed", value: 120 } });
    const result = findApplicableRule(visitaTecA, [ruleGeral, ruleEspecifica]);
    expect(result.type).toBe("match");
    if (result.type === "match") expect(result.rule.id).toBe("esp");
  });
});

// As regras de suporte externo (R$ 120 aéreo / R$ 135 subterrâneo) valem para o suporte COM
// troca de drop — receita da Unetvale ~R$ 206 / ~R$ 232. O suporte simples ("Suporte | 50 * 1.1",
// receita R$ 64,46) chegava a casá-las quando a planilha trazia tipo Externo + meio preenchido,
// pagando 4x o devido com margem negativa. O threshold por `valorRecebidoUnetvale` (prioridade
// 500 > 400) separa os dois casos — ver a migration 0032_lpu_suporte_externo_sem_troca_drop.sql
// e docs/domain/05-regras-especiais.md.
describe("threshold de receita: suporte externo com x sem troca de drop", () => {
  const SUPORTE_EXTERNO_AEREO = {
    finalidade: "Suporte Fibra",
    tipoAtendimento: "Externo",
    subterraneaAereo: "Aéreo",
    agregada: false,
  };

  const regraTrocaDrop = makeRule({
    id: "troca-drop",
    prioridade: 400,
    conditions: SUPORTE_EXTERNO_AEREO,
    payout: { type: "fixed", value: 120 },
    description: "Suporte Fibra Aéreo Externo",
  });

  const regraSemTrocaDrop = makeRule({
    id: "sem-troca-drop",
    prioridade: 500,
    conditions: {
      ...SUPORTE_EXTERNO_AEREO,
      valorRecebidoUnetvale: { min: 40, max: 150 },
    },
    payout: { type: "fixed", value: 30 },
    description: "Suporte Fibra Aéreo Externo sem troca de drop",
  });

  const rules = [regraTrocaDrop, regraSemTrocaDrop];

  it("suporte simples (receita R$ 64,46) paga R$ 30", () => {
    const visita: VisitForMatch = {
      ...BASE_VISIT,
      subterraneaAereo: "Aéreo",
      valorRecebidoUnetvale: 64.46,
    };
    const result = findApplicableRule(visita, rules);
    expect(result.type).toBe("match");
    if (result.type === "match") expect(result.rule.id).toBe("sem-troca-drop");
  });

  it("suporte com troca de drop (receita R$ 206,26) segue em R$ 120", () => {
    const visita: VisitForMatch = {
      ...BASE_VISIT,
      subterraneaAereo: "Aéreo",
      valorRecebidoUnetvale: 206.26,
    };
    const result = findApplicableRule(visita, rules);
    expect(result.type).toBe("match");
    if (result.type === "match") expect(result.rule.id).toBe("troca-drop");
  });

  it("receita R$ 0,00 fica fora do threshold (piso R$ 40) e mantém o valor cheio", () => {
    const visita: VisitForMatch = {
      ...BASE_VISIT,
      subterraneaAereo: "Aéreo",
      valorRecebidoUnetvale: 0,
    };
    const result = findApplicableRule(visita, rules);
    expect(result.type).toBe("match");
    if (result.type === "match") expect(result.rule.id).toBe("troca-drop");
  });

  it("receita nula não casa o threshold (range exige número)", () => {
    const visita: VisitForMatch = {
      ...BASE_VISIT,
      subterraneaAereo: "Aéreo",
      valorRecebidoUnetvale: null,
    };
    const result = findApplicableRule(visita, rules);
    expect(result.type).toBe("match");
    if (result.type === "match") expect(result.rule.id).toBe("troca-drop");
  });
});
