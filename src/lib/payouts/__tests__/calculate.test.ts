import { describe, expect, it } from "vitest";
import { buildPayoutUpsert } from "../calculate";
import type { LpuRuleNarrowed } from "@/lib/lpu/types";
import type { ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";

const TENANT_ID = "tenant-1";
const LPU_ID = "lpu-1";

function makeVisit(overrides: Partial<SimVisit> = {}): SimVisit {
  return {
    id: "visit-1",
    osNum: 12345,
    tecnicoId: "tech-1",
    reasonId: null,
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
    ...overrides,
  };
}

function makeRule(overrides: Partial<LpuRuleNarrowed> = {}): LpuRuleNarrowed {
  return {
    id: "rule-1",
    lpuId: LPU_ID,
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

function makeReason(overrides: Partial<ReasonForPayout> = {}): ReasonForPayout {
  return {
    id: "reason-1",
    categoria: "falha_tecnico",
    pagaImprodutiva: false,
    valorImprodutiva: null,
    ...overrides,
  };
}

describe("buildPayoutUpsert", () => {
  it("sucesso com regra fixed → status pending_review, valor calculado", () => {
    const result = buildPayoutUpsert(
      makeVisit(),
      [makeRule()],
      [],
      LPU_ID,
      TENANT_ID,
    );
    expect(result.status).toBe("pending_review");
    expect(result.valorCalculado).toBe(80);
    expect(result.valorDeixadoNaMesa).toBe(0);
  });

  it("sucesso com regra formula → calcula com base + campo", () => {
    const rule = makeRule({
      payout: {
        type: "formula",
        base: 30,
        additional: { field: "dropUsado", ratePerUnit: 0.5 },
      },
    });
    const result = buildPayoutUpsert(makeVisit(), [rule], [], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(50); // 30 + 40 * 0.5
    expect(result.status).toBe("pending_review");
  });

  it("sucesso com regra percentage_of_revenue → percentual da receita", () => {
    const rule = makeRule({
      payout: { type: "percentage_of_revenue", percentage: 30 },
    });
    const result = buildPayoutUpsert(makeVisit(), [rule], [], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(60); // 200 * 0.30
  });

  it("falha_tecnico → valor 0, deixadoNaMesa calculado, status pending_review", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 200,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const rules = [makeRule({ conditions: { sucesso: "Sim" } })];
    const result = buildPayoutUpsert(visit, rules, [reason], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(0);
    expect(result.valorDeixadoNaMesa).toBe(80); // valor da regra se tivesse sucesso
    expect(result.status).toBe("pending_review");
  });

  it("falha_cliente com pagaImprodutiva → status pending_review, valor improdutiva override", () => {
    const visit = makeVisit({ sucesso: "Não", reasonId: "reason-1" });
    const reason = makeReason({
      categoria: "falha_cliente",
      pagaImprodutiva: true,
      valorImprodutiva: 25,
    });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(25);
    expect(result.status).toBe("pending_review");
  });

  it("sem regra matching → status no_rule_match, valor null", () => {
    const result = buildPayoutUpsert(
      makeVisit({ sucesso: "Sim" }),
      [], // nenhuma regra
      [],
      LPU_ID,
      TENANT_ID,
    );
    expect(result.status).toBe("no_rule_match");
    expect(result.valorCalculado).toBeNull();
  });

  it("motivo pendente classificação → status pending_classification", () => {
    const visit = makeVisit({ sucesso: "Não", reasonId: "reason-1" });
    const reason = makeReason({ categoria: "pendente_classificacao" });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID);
    expect(result.status).toBe("pending_classification");
  });
});
