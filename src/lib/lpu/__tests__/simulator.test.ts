import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import type { LpuRuleNarrowed, ReasonForPayout } from "../types";
import type { SimVisit } from "../simulator";

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

function makeVisit(overrides: Partial<SimVisit> = {}): SimVisit {
  return {
    id: "visit-1",
    osNum: 12345,
    tecnicoId: "tec-1",
    reasonId: null,
    finalidade: "Suporte Fibra",
    tipoAtendimento: "Externo",
    sucesso: "Sim",
    cidade: "São Paulo",
    condominio: false,
    dropUsado: null,
    faixaDrop: null,
    conectoresUsados: null,
    garantia: false,
    subterraneaAereo: null,
    valorRecebidoUnetvale: 200,
    ...overrides,
  };
}

describe("simulate", () => {
  it("todas as visitas com regra → visitasComRegra === total e totalEstimadoPagar > 0", () => {
    const rules = [makeRule()];
    const visitas = [
      makeVisit({ id: "v1" }),
      makeVisit({ id: "v2" }),
    ];
    const result = simulate(rules, visitas, []);
    expect(result.totalVisitas).toBe(2);
    expect(result.visitasComRegra).toBe(2);
    expect(result.visitasSemRegra).toBe(0);
    expect(result.totalEstimadoPagar).toBe(160); // 2 × 80
  });

  it("mix de visitas com e sem regra → contagens corretas", () => {
    const rules = [makeRule({ conditions: { sucesso: "Sim" } })];
    const visitas = [
      makeVisit({ id: "v1", sucesso: "Sim" }),
      makeVisit({ id: "v2", sucesso: "Não - Endereço não encontrado", reasonId: "r1" }),
    ];
    const reasons: ReasonForPayout[] = [
      { id: "r1", categoria: "falha_tecnico", pagaImprodutiva: false, valorImprodutiva: null },
    ];
    const result = simulate(rules, visitas, reasons);
    // v1 (sucesso=Sim) → valor=80, v2 (falha_tecnico, valor=0) → ambas pending c/ valor!=null
    expect(result.visitasComRegra).toBe(2);
    expect(result.visitasSemRegra).toBe(0);
    expect(result.totalEstimadoPagar).toBe(80); // v2 contribui 0
  });

  it("visita com motivo pendente_classificacao → visitasPendentes++", () => {
    const rules = [makeRule()];
    const reason: ReasonForPayout = {
      id: "r1",
      categoria: "pendente_classificacao",
      pagaImprodutiva: false,
      valorImprodutiva: null,
    };
    const visita = makeVisit({
      sucesso: "Não - Motivo Novo",
      reasonId: "r1",
    });
    const result = simulate(rules, [visita], [reason]);
    expect(result.visitasPendentes).toBe(1);
    expect(result.visitasComRegra).toBe(0);
  });

  it("lista vazia → todos os campos zerados", () => {
    const result = simulate([], [], []);
    expect(result.totalVisitas).toBe(0);
    expect(result.visitasComRegra).toBe(0);
    expect(result.totalEstimadoPagar).toBe(0);
    expect(result.receitaTotal).toBe(0);
    expect(result.margem).toBe(0);
    expect(result.distribuicaoPorTecnico).toHaveLength(0);
    expect(result.visitasSemRegraDetalhes).toHaveLength(0);
  });
});
