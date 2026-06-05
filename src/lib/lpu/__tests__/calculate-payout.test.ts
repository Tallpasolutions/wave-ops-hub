import { describe, expect, it } from "vitest";
import {
  applyPayoutFormula,
  calculateDeixadoNaMesa,
  calculatePayout,
} from "../calculate-payout";
import type {
  LpuRuleNarrowed,
  PayoutFormula,
  ReasonForPayout,
  VisitForMatch,
} from "../types";

const BASE_VISIT: VisitForMatch = {
  finalidade: "Suporte Fibra",
  tipoAtendimento: "Externo",
  sucesso: "Sim",
  cidade: "São Paulo",
  condominio: false,
  dropUsado: 40,
  faixaDrop: null,
  conectoresUsados: 2,
  garantia: false,
  subterraneaAereo: null,
  valorRecebidoUnetvale: 200,
};

function makeRule(overrides: Partial<LpuRuleNarrowed> = {}): LpuRuleNarrowed {
  return {
    id: "rule-1",
    lpuId: "lpu-1",
    prioridade: 100,
    conditions: { sucesso: "Sim" },
    payout: { type: "fixed", value: 80 },
    description: "Regra base",
    ativa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeReason(
  overrides: Partial<ReasonForPayout> = {},
): ReasonForPayout {
  return {
    id: "reason-1",
    categoria: "falha_tecnico",
    pagaImprodutiva: false,
    valorImprodutiva: null,
    ...overrides,
  };
}

describe("applyPayoutFormula", () => {
  it("payout fixed → retorna valor exato", () => {
    const result = applyPayoutFormula({ type: "fixed", value: 80 }, BASE_VISIT);
    expect(result).toBe(80);
  });

  it("payout formula com dropUsado preenchido → base + drop * rate", () => {
    const payout: PayoutFormula = {
      type: "formula",
      base: 50,
      additional: { field: "dropUsado", ratePerUnit: 0.3 },
    };
    const result = applyPayoutFormula(payout, BASE_VISIT);
    expect(result).toBeCloseTo(62); // 50 + (40 × 0.3) = 62
  });

  it("payout formula com dropUsado null → retorna só base", () => {
    const payout: PayoutFormula = {
      type: "formula",
      base: 50,
      additional: { field: "dropUsado", ratePerUnit: 0.3 },
    };
    const result = applyPayoutFormula(payout, {
      ...BASE_VISIT,
      dropUsado: null,
    });
    expect(result).toBe(50);
  });

  it("payout percentage_of_revenue → valorRecebido * (% / 100)", () => {
    const result = applyPayoutFormula(
      { type: "percentage_of_revenue", percentage: 60 },
      BASE_VISIT,
    );
    expect(result).toBe(120); // 200 × 0.60
  });
});

describe("calculatePayout", () => {
  it("visita com sucesso sem regra → no_rule_match", () => {
    const result = calculatePayout(BASE_VISIT, [], null);
    expect(result.status).toBe("no_rule_match");
    expect(result.valor).toBeNull();
  });

  it("improdutiva com pagaImprodutiva=false → valor 0, status pending, calcula deixadoNaMesa", () => {
    const rule = makeRule({
      conditions: { sucesso: "Sim" },
      payout: { type: "fixed", value: 100 },
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const visita = { ...BASE_VISIT, sucesso: "Não - Endereço não encontrado" };
    const result = calculatePayout(visita, [rule], reason);
    expect(result.status).toBe("pending");
    expect(result.valor).toBe(0);
    expect(result.deixadoNaMesa).toBe(100);
  });

  it("improdutiva com valorImprodutiva definido → retorna valor override", () => {
    const reason = makeReason({
      categoria: "falha_cliente",
      pagaImprodutiva: true,
      valorImprodutiva: 25,
    });
    const visita = { ...BASE_VISIT, sucesso: "Não - Cliente ausente" };
    const result = calculatePayout(visita, [], reason);
    expect(result.status).toBe("pending");
    expect(result.valor).toBe(25);
  });

  it("motivo pendente_classificacao → pending_classification", () => {
    const reason = makeReason({ categoria: "pendente_classificacao" });
    const visita = { ...BASE_VISIT, sucesso: "Não - Motivo Novo" };
    const result = calculatePayout(visita, [], reason);
    expect(result.status).toBe("pending_classification");
    expect(result.valor).toBeNull();
  });
});

describe("calculateDeixadoNaMesa", () => {
  it("categoria != falha_tecnico → retorna 0", () => {
    const rule = makeRule({ conditions: { sucesso: "Sim" }, payout: { type: "fixed", value: 100 } });
    const reason = makeReason({ categoria: "falha_cliente" });
    const visita = { ...BASE_VISIT, sucesso: "Não - Cliente ausente" };
    expect(calculateDeixadoNaMesa(visita, [rule], reason)).toBe(0);
  });

  it("falha_tecnico com regra disponível → retorna valor da regra simulada", () => {
    const rule = makeRule({ conditions: { sucesso: "Sim" }, payout: { type: "fixed", value: 100 } });
    const reason = makeReason({ categoria: "falha_tecnico" });
    const visita = { ...BASE_VISIT, sucesso: "Não - Endereço não encontrado" };
    expect(calculateDeixadoNaMesa(visita, [rule], reason)).toBe(100);
  });
});
