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
    agregada: false,
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

// Improdutiva padrão: Unetvale 15,98 → Wave paga 15,00 fixos e auto-aprova, independente do motivo.
describe("buildPayoutUpsert — improdutiva padrão (Unetvale 15,98)", () => {
  it("improdutiva com Unetvale 15,98 → 15,00 aprovada, independente do motivo (falha_tecnico)", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 15.98,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(15);
    expect(result.status).toBe("approved");
    expect(result.improdutivaAprovada).toBe(true);
    expect(result.valorDeixadoNaMesa).toBe(0);
  });

  it("improdutiva com Unetvale 15,98 auto-aprova mesmo sem motivo classificado", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: null,
      valorRecebidoUnetvale: 15.98,
    });
    const result = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(15);
    expect(result.status).toBe("approved");
    expect(result.improdutivaAprovada).toBe(true);
  });

  it("improdutiva com Unetvale fora de 15,98 → segue fluxo normal, sem auto-aprovação", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 20,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const rules = [makeRule({ conditions: { sucesso: "Sim" } })];
    const result = buildPayoutUpsert(visit, rules, [reason], LPU_ID, TENANT_ID);
    expect(result.status).toBe("pending_review");
    expect(result.improdutivaAprovada).toBeNull();
    expect(result.valorCalculado).toBe(0);
  });

  it("improdutiva 15,98 sem técnico mapeado → NÃO auto-aprova (cai no fluxo normal)", () => {
    const visit = makeVisit({
      sucesso: "Não",
      tecnicoId: null,
      reasonId: "reason-1",
      valorRecebidoUnetvale: 15.98,
    });
    const reason = makeReason({ categoria: "pendente_classificacao" });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID);
    expect(result.status).not.toBe("approved");
    expect(result.improdutivaAprovada).toBeNull();
  });

  it("improdutiva com Unetvale 0,00 → payout R$ 0, sai da fila (improdutivaAprovada=false), preserva deixado na mesa", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 0,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const rules = [makeRule({ conditions: { sucesso: "Sim" } })];
    const result = buildPayoutUpsert(visit, rules, [reason], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(0);
    expect(result.improdutivaAprovada).toBe(false);
    expect(result.status).toBe("pending_review");
    expect(result.valorDeixadoNaMesa).toBe(80); // deixado na mesa preservado
  });

  it("improdutiva com Unetvale 0,00 e decisão manual existente → fluxo normal (não força R$ 0 automático)", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 0,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const result = buildPayoutUpsert(
      visit,
      [makeRule()],
      [reason],
      LPU_ID,
      TENANT_ID,
      undefined,
      undefined,
      undefined,
      true, // manualDecisionExists
    );
    expect(result.improdutivaAprovada).toBeNull();
  });

  it("improdutiva com Unetvale null (desconhecida) → NÃO trata como zero, segue fluxo normal", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: null,
    });
    const reason = makeReason({ categoria: "falha_cliente", pagaImprodutiva: true, valorImprodutiva: 25 });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID);
    expect(result.improdutivaAprovada).toBeNull();
    expect(result.valorCalculado).toBe(25);
  });

  it("improdutiva 15,98 com decisão manual existente → NÃO auto-aprova (respeita o gestor)", () => {
    const visit = makeVisit({
      sucesso: "Não",
      reasonId: "reason-1",
      valorRecebidoUnetvale: 15.98,
    });
    const reason = makeReason({ categoria: "falha_tecnico", pagaImprodutiva: false });
    const result = buildPayoutUpsert(
      visit,
      [makeRule()],
      [reason],
      LPU_ID,
      TENANT_ID,
      undefined,
      undefined,
      undefined,
      true, // manualDecisionExists
    );
    expect(result.status).not.toBe("approved");
    expect(result.improdutivaAprovada).toBeNull();
  });

  it("sucesso com Unetvale 15,98 → não é improdutiva, segue regra de LPU", () => {
    const visit = makeVisit({ sucesso: "Sim", valorRecebidoUnetvale: 15.98 });
    const result = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(result.status).toBe("pending_review");
    expect(result.valorCalculado).toBe(80);
    expect(result.improdutivaAprovada).toBeNull();
  });
});

// ADR-009: Cabeamento/Condomínio pagam pela classificação do gestor (explicacao_valor), não pela LPU.
describe("buildPayoutUpsert — classificação de Cabeamento (ADR-009)", () => {
  const classification = {
    finalidades: new Set(["cabeamento/segundo ponto"]),
    map: new Map([["Cabeamento agregado", 44]]),
  };

  it("grupo + sucesso + chave classificada → pending_review com o valor da classificação", () => {
    const visit = makeVisit({
      finalidade: "Cabeamento/Segundo Ponto",
      sucesso: "Sim",
      explicacaoValor: "Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)",
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, classification);
    expect(result.status).toBe("pending_review");
    expect(result.valorCalculado).toBe(44);
    expect(result.lpuRuleId).toBeNull();
    expect(result.valorDeixadoNaMesa).toBe(0);
  });

  it("grupo + sucesso + chave NÃO classificada → no_rule_match (surge na fila)", () => {
    const visit = makeVisit({
      finalidade: "Cabeamento/Segundo Ponto",
      sucesso: "Sim",
      explicacaoValor: "Cabeamento de 3 pontos | 106 (Reajuste +6,54% fevereiro/2025)",
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, classification);
    expect(result.status).toBe("no_rule_match");
    expect(result.valorCalculado).toBeNull();
  });

  it("grupo + improdutiva → segue o fluxo de motivo (não classifica)", () => {
    const visit = makeVisit({
      finalidade: "Cabeamento/Segundo Ponto",
      sucesso: "Não",
      reasonId: "reason-1",
    });
    const reason = makeReason({ categoria: "pendente_classificacao" });
    const result = buildPayoutUpsert(visit, [], [reason], LPU_ID, TENANT_ID, classification);
    expect(result.status).toBe("pending_classification");
  });

  it("fora do grupo → fluxo normal de LPU intacto (mesmo com ctx de classificação)", () => {
    const visit = makeVisit({ finalidade: "Suporte Fibra", sucesso: "Sim" });
    const rule = makeRule({ conditions: { sucesso: "Sim" }, payout: { type: "fixed", value: 80 } });
    const result = buildPayoutUpsert(visit, [rule], [], LPU_ID, TENANT_ID, classification);
    expect(result.status).toBe("pending_review");
    expect(result.valorCalculado).toBe(80);
    expect(result.lpuRuleId).toBe("rule-1");
  });
});

describe("buildPayoutUpsert — repasse de Homologação (ADR-015)", () => {
  // valores da Unetvale em centavos → repasse ao técnico
  const homologacao = {
    valores: new Map([
      [6446, 35], // base
      [12892, 70], // dobrado
      [14223, 79], // + 1 ponto adicional
    ]),
  };
  const explBase = "Homologação | 60.50 (Reajuste +6,54% fevereiro/2025)";
  const explPonto =
    "Homologação | 60.50 (+73 * 1 ponto(s) adicional(is)) (Reajuste +6,54% fevereiro/2025)";

  it("homologação base → repassa R$ 35, sem regra de LPU", () => {
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Sim",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 64.46,
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.status).toBe("pending_review");
    expect(result.valorCalculado).toBe(35);
    expect(result.lpuRuleId).toBeNull();
    expect(result.valorDeixadoNaMesa).toBe(0);
  });

  it("homologação dobrada (Unetvale 128,92) → R$ 70", () => {
    const visit = makeVisit({
      finalidade: "Mudança Endereço Fibra",
      sucesso: "Sim",
      explicacaoValor: explBase, // mesmo texto da base; só o valor Unetvale distingue
      valorRecebidoUnetvale: 128.92,
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.valorCalculado).toBe(70);
  });

  it("homologação + 1 ponto adicional (Unetvale 142,23) → R$ 79", () => {
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PJ",
      sucesso: "Sim",
      explicacaoValor: explPonto,
      valorRecebidoUnetvale: 142.23,
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.valorCalculado).toBe(79);
  });

  it("homologação com valor Unetvale NÃO cadastrado → no_rule_match (surge na fila)", () => {
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Sim",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 99.99,
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.status).toBe("no_rule_match");
    expect(result.valorCalculado).toBeNull();
  });

  it("homologação PRECEDE a regra de LPU da instalação (135 → 35)", () => {
    const ruleInstalacao = makeRule({
      conditions: { finalidade: ["Instalação - Fibra - PF"], subterraneaAereo: "Subterrâneo" },
      payout: { type: "fixed", value: 135 },
      prioridade: 300,
    });
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Sim",
      subterraneaAereo: "Subterrâneo",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 64.46,
    });
    const result = buildPayoutUpsert(visit, [ruleInstalacao], [], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.valorCalculado).toBe(35);
    expect(result.lpuRuleId).toBeNull();
  });

  it("sem contexto de homologação → cai na LPU normal (feature desligada)", () => {
    const ruleInstalacao = makeRule({
      conditions: { finalidade: ["Instalação - Fibra - PF"], subterraneaAereo: "Subterrâneo" },
      payout: { type: "fixed", value: 135 },
      prioridade: 300,
    });
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Sim",
      subterraneaAereo: "Subterrâneo",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 64.46,
    });
    const result = buildPayoutUpsert(visit, [ruleInstalacao], [], LPU_ID, TENANT_ID);
    expect(result.valorCalculado).toBe(135);
    expect(result.lpuRuleId).toBe("rule-1");
  });

  it("homologação improdutiva → não é tratada como homologação (fluxo de motivo)", () => {
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Não",
      reasonId: "reason-1",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 64.46,
    });
    const reason = makeReason({ categoria: "pendente_classificacao" });
    const result = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID, undefined, undefined, homologacao);
    expect(result.valorCalculado).not.toBe(35);
  });

  it("homologação em domingo → repasse com acréscimo (ADR-011)", () => {
    const feriado = { feriados: new Set<string>(), pct: 15 };
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      sucesso: "Sim",
      explicacaoValor: explBase,
      valorRecebidoUnetvale: 64.46,
      dataExecucao: "2026-06-07", // domingo
    });
    const result = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, undefined, feriado, homologacao);
    expect(result.valorCalculado).toBeCloseTo(40.25, 2); // 35 × 1,15
  });
});

// ADR-011: +15% em execução com sucesso de domingo/feriado (2026-06-07 é domingo).
describe("buildPayoutUpsert — acréscimo de domingo/feriado (ADR-011)", () => {
  const feriado = { feriados: new Set<string>(), pct: 15 };
  const ruleFixo80 = makeRule({ conditions: { sucesso: "Sim" }, payout: { type: "fixed", value: 80 } });

  it("sucesso em domingo → valor × 1,15", () => {
    const visit = makeVisit({ sucesso: "Sim", dataExecucao: "2026-06-07" });
    const r = buildPayoutUpsert(visit, [ruleFixo80], [], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBeCloseTo(92, 2); // 80 × 1,15
  });

  it("sucesso em dia útil → sem acréscimo", () => {
    const visit = makeVisit({ sucesso: "Sim", dataExecucao: "2026-06-08" }); // segunda
    const r = buildPayoutUpsert(visit, [ruleFixo80], [], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBe(80);
  });

  it("Cabeamento classificado em domingo → valor × 1,15", () => {
    const classification = {
      finalidades: new Set(["cabeamento/segundo ponto"]),
      map: new Map([["Cabeamento agregado", 44]]),
    };
    const visit = makeVisit({
      finalidade: "Cabeamento/Segundo Ponto",
      sucesso: "Sim",
      dataExecucao: "2026-06-07",
      explicacaoValor: "Cabeamento agregado | 73 (Reajuste +6,54% fevereiro/2025)",
    });
    const r = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, classification, feriado);
    expect(r.valorCalculado).toBeCloseTo(50.6, 2); // 44 × 1,15
  });

  it("improdutiva paga em domingo → SEM acréscimo (só execução com sucesso)", () => {
    const visit = makeVisit({ sucesso: "Não", reasonId: "reason-1", dataExecucao: "2026-06-07" });
    const reason = makeReason({ pagaImprodutiva: true, valorImprodutiva: 30 });
    const r = buildPayoutUpsert(visit, [makeRule()], [reason], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBe(30);
  });

  // Retirada não recebe o acréscimo de domingo/feriado (decisão do gestor, 24/07).
  const ruleRetirada = makeRule({
    conditions: { finalidade: ["Retirada"] },
    payout: { type: "fixed", value: 20 },
    prioridade: 100,
  });

  it("Retirada (LPU) em domingo → SEM acréscimo", () => {
    const visit = makeVisit({ finalidade: "Retirada", sucesso: "Sim", dataExecucao: "2026-06-07" });
    const r = buildPayoutUpsert(visit, [ruleRetirada], [], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBe(20);
  });

  it("Retirada Condomínio (cabeamento) em domingo → SEM acréscimo", () => {
    const classification = {
      finalidades: new Set(["retirada condomínio"]),
      map: new Map([["Retirada", 60]]),
    };
    const visit = makeVisit({
      finalidade: "Retirada Condomínio",
      sucesso: "Sim",
      dataExecucao: "2026-06-07",
      explicacaoValor: "Retirada",
    });
    const r = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, classification, feriado);
    expect(r.valorCalculado).toBe(60);
  });

  it("Retirada em dia útil → valor normal (controle)", () => {
    const visit = makeVisit({ finalidade: "Retirada", sucesso: "Sim", dataExecucao: "2026-06-08" });
    const r = buildPayoutUpsert(visit, [ruleRetirada], [], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBe(20);
  });
});

// ADR-016: ajustes por coluna Z — Unetvale 29,30, pontos adicionais e Venda Produto Externo.
describe("buildPayoutUpsert — ADR-016 (coluna Z)", () => {
  const REAJ = "(Reajuste +6,54% fevereiro/2025)";
  const instalSubterranea = makeRule({
    conditions: { finalidade: ["Instalação - Fibra - PF"], subterraneaAereo: "Subterrâneo" },
    payout: { type: "fixed", value: 135 },
    prioridade: 300,
  });

  it("Unetvale 29,30 → não paga (R$ 0), qualquer finalidade", () => {
    const visit = makeVisit({
      finalidade: "Troca de Equipamentos",
      sucesso: "Sim",
      valorRecebidoUnetvale: 29.3,
      explicacaoValor: `Roteador agregado ‡ OS de Suporte ou Cabeamento | 25 * 1.1 ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(r.valorCalculado).toBe(0);
    expect(r.lpuRuleId).toBeNull();
  });

  it("instalação subterrânea + 1 ponto adicional → base 135 + 36 = 171", () => {
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      subterraneaAereo: "Subterrâneo",
      sucesso: "Sim",
      valorRecebidoUnetvale: 356.23,
      explicacaoValor: `Instalação nova | 180 (subterrâneo) * 1.1 (+73 * 1 ponto(s) adicional(is)) ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [instalSubterranea], [], LPU_ID, TENANT_ID);
    expect(r.valorCalculado).toBe(171);
  });

  it("ponto adicional + domingo → (135 + 36) × 1,15 = 196,65", () => {
    const feriado = { feriados: new Set<string>(), pct: 15 };
    const visit = makeVisit({
      finalidade: "Instalação - Fibra - PF",
      subterraneaAereo: "Subterrâneo",
      sucesso: "Sim",
      dataExecucao: "2026-06-07", // domingo
      explicacaoValor: `Instalação nova | 180 (subterrâneo) (+73 * 1 ponto(s) adicional(is)) ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [instalSubterranea], [], LPU_ID, TENANT_ID, undefined, feriado);
    expect(r.valorCalculado).toBeCloseTo(196.65, 2);
  });

  it("cabeamento com ponto → base 44 + 36 = 80 (corrige o 76 embutido)", () => {
    const classification = {
      finalidades: new Set(["cabeamento/segundo ponto"]),
      map: new Map([["Cabeamento", 44]]),
    };
    const visit = makeVisit({
      finalidade: "Cabeamento/Segundo Ponto",
      sucesso: "Sim",
      explicacaoValor: `Cabeamento | 88 (+73 * 1 ponto(s) adicional(is)) ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [], [], LPU_ID, TENANT_ID, classification);
    expect(r.valorCalculado).toBe(80);
  });

  it("Venda Produto Externo · Roteador → R$ 30", () => {
    const visit = makeVisit({
      finalidade: "Venda Produto Externo",
      sucesso: "Sim",
      valorRecebidoUnetvale: 64.46,
      explicacaoValor: `Roteador | 50 * 1.1 * 1.1 (+10% em instalações e suportes a partir de 03/2019) ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(r.valorCalculado).toBe(30);
    expect(r.lpuRuleId).toBeNull();
  });

  it("Venda Produto Externo · Cabeamento agregado → R$ 44", () => {
    const visit = makeVisit({
      finalidade: "Venda Produto Externo",
      sucesso: "Sim",
      valorRecebidoUnetvale: 77.77,
      explicacaoValor: `Cabeamento agregado | 73 ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(r.valorCalculado).toBe(44);
  });

  it("Venda Produto Externo · Roteador agregado (Unetvale 0) → R$ 0", () => {
    const visit = makeVisit({
      finalidade: "Venda Produto Externo",
      sucesso: "Sim",
      valorRecebidoUnetvale: 0,
      explicacaoValor: `Roteador agregado à OS que não é de Suporte nem Cabeamento | 25 ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(r.valorCalculado).toBe(0);
  });

  it("Venda Produto Externo não reconhecido → no_rule_match (surge na fila)", () => {
    const visit = makeVisit({
      finalidade: "Venda Produto Externo",
      sucesso: "Sim",
      valorRecebidoUnetvale: 93.76,
      explicacaoValor: `Serviço desconhecido | 88 ${REAJ}`,
    });
    const r = buildPayoutUpsert(visit, [makeRule()], [], LPU_ID, TENANT_ID);
    expect(r.status).toBe("no_rule_match");
    expect(r.valorCalculado).toBeNull();
  });
});
