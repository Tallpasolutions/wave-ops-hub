import {
  calculatePayout,
  calculateDeixadoNaMesa,
} from "@/lib/lpu/calculate-payout";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import { normalizeExplicacao, isHomologacao, parsePontosAdicionais } from "@/lib/etl/explicacao";
import { isDomingoOuFeriado, aplicarAcrescimo } from "./feriado";
import type { DbPayoutStatus, PayoutUpsertData } from "./types";

// ADR-009: finalidades de Cabeamento/Condomínio não têm regra de LPU — o valor vem da
// classificação do gestor por explicacao_valor normalizada. `finalidades` guarda os nomes
// normalizados (trim+lower) do grupo; `map` é explicacao_key → valor.
export type ClassificationCtx = {
  map: Map<string, number>;
  finalidades: Set<string>;
};

// ADR-011: acréscimo de domingo/feriado (config do tenant). `feriados` = datas "YYYY-MM-DD".
export type FeriadoCtx = {
  feriados: Set<string>;
  pct: number;
};

// ADR-015: repasse de homologação indexado pelo valor da Unetvale em centavos
// (arredondado, para evitar drift de float). Presença do contexto = feature ligada
// para o tenant. `valores` mapeia centavos da receita Unetvale → repasse ao técnico.
export type HomologacaoCtx = {
  valores: Map<number, number>;
};

// Regra de improdutiva por receita da Unetvale (valores fixos por ora; troca exige deploy):
//   - Unetvale = R$ 15,98 → improdutiva padrão: Wave repassa R$ 15,00 fixos ao técnico e o
//     payout já sai APROVADO, sem depender da classificação do motivo. Não entra na fila.
//   - Unetvale = R$ 0,00 → a Unetvale não reembolsou (típico de falha do técnico): payout
//     R$ 0,00 e sai da fila automaticamente (decisão de não pagar). Preserva o "deixado na mesa".
//   - Qualquer outra receita → fluxo normal, entra na fila de validação por motivo.
// Comparações em centavos para evitar drift de float.
const UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS = 1598;
const PAYOUT_IMPRODUTIVA_PADRAO = 15.0;

// ADR-016: Unetvale = R$ 29,30 → não paga o técnico (tipicamente "Roteador agregado ‡ OS de
// Suporte/Cabeamento"). Regra por valor da receita, independente da finalidade.
const UNETVALE_NAO_PAGA_CENTAVOS = 2930;

// ADR-016: cada "ponto(s) adicional(is)" da coluna Z soma um acréscimo fixo sobre o valor-base
// do serviço. Uniforme para instalação/cabeamento/condomínio. Homologação tem tratamento próprio
// (o repasse com ponto já vem do mapa de homologação — ADR-015).
const PONTO_ADICIONAL_VALOR = 36;

// ADR-019: valores próprios da tabela de preços (migration 0035). Cada campo ausente cai no
// valor histórico acima — a LPU padrão não declara nenhum, então seu cálculo é idêntico ao de
// antes desta mudança. Só uma LPU alternativa que declare valores muda de comportamento.
export type LpuValores = {
  pontoAdicional?: number | null;
  improdutiva?: number | null;
  feriadoPct?: number | null;
};

function isImprodutivaPadrao(valorRecebidoUnetvale: number | null): boolean {
  if (valorRecebidoUnetvale === null) return false;
  return Math.round(valorRecebidoUnetvale * 100) === UNETVALE_IMPRODUTIVA_PADRAO_CENTAVOS;
}

// Unetvale = R$ 0,00 exato. `null` (receita desconhecida) NÃO conta como zero — cai no fluxo normal.
function isUnetvaleZero(valorRecebidoUnetvale: number | null): boolean {
  if (valorRecebidoUnetvale === null) return false;
  return Math.round(valorRecebidoUnetvale * 100) === 0;
}

function isUnetvaleNaoPaga(valorRecebidoUnetvale: number | null): boolean {
  if (valorRecebidoUnetvale === null) return false;
  return Math.round(valorRecebidoUnetvale * 100) === UNETVALE_NAO_PAGA_CENTAVOS;
}

// ADR-016: "Venda Produto Externo" — a finalidade da Unetvale é genérica; o serviço real (e o
// valor) está na coluna Z. Retorna o valor-base do repasse, ou null se não reconhecido (→ fila).
function resolveVendaProdutoExterno(explicacaoValor: string | null | undefined): number | null {
  const raw = (explicacaoValor ?? "").trim().toLowerCase();
  if (!raw) return null;
  // "Roteador agregado ‡/à OS ..." não é pago (também coberto por Unetvale 29,30/0).
  if (raw.startsWith("roteador agregado")) return 0;
  if (raw.startsWith("roteador")) return 30;
  const key = normalizeExplicacao(explicacaoValor);
  if (key === "Cabeamento agregado" || key === "Cabeamento") return 44;
  return null;
}

// Mapeia o status de 4 valores do match engine para o status de 10 valores do DB.
// O resultado do motor LPU usa "pending" para "regra encontrada e payout calculado".
// No DB, payouts recém-calculados ficam como "pending_review" (aguardando fechamento).
function mapStatus(lpuStatus: "pending" | "no_rule_match" | "conflict" | "pending_classification"): DbPayoutStatus {
  if (lpuStatus === "pending") return "pending_review";
  return lpuStatus;
}

export function buildPayoutUpsert(
  visit: SimVisit,
  rules: LpuRuleNarrowed[],
  reasons: ReasonForPayout[],
  lpuId: string | null,
  tenantId: string,
  classification?: ClassificationCtx,
  feriado?: FeriadoCtx,
  homologacao?: HomologacaoCtx,
  // Salvaguarda de função pura: se já existe decisão manual do gestor para esta visita, as
  // regras automáticas de improdutiva NÃO se aplicam. Na prática o recálculo em lote já protege
  // isso antes (pula payouts com override_by/approved/paid — ver recalculate-batch.ts), então
  // este parâmetro fica em `false`; existe para manter o contrato correto se a função for
  // chamada por outro caminho.
  manualDecisionExists = false,
  // ADR-019: valores da tabela de preços que está pagando esta visita. Omitido/vazio =
  // valores históricos (o caso da LPU padrão).
  lpuValores?: LpuValores,
): PayoutUpsertData {
  // ADR-019: cada valor cai no histórico quando a LPU não declara o seu. `?? ` (e não `||`)
  // para que um valor legítimo de R$ 0 configurado pelo gestor seja respeitado.
  const pontoAdicionalValor = lpuValores?.pontoAdicional ?? PONTO_ADICIONAL_VALOR;
  const improdutivaValor = lpuValores?.improdutiva ?? PAYOUT_IMPRODUTIVA_PADRAO;

  // ADR-009: visita com sucesso do grupo Cabeamento/Condomínio → payout vem da
  // classificação (não da LPU). Improdutivas e demais finalidades seguem o fluxo normal.
  const finalidadeKey = visit.finalidade?.trim().toLowerCase();
  const isGrupo = !!finalidadeKey && !!classification?.finalidades.has(finalidadeKey);
  const isSucesso = visit.sucesso.trim().toLowerCase().startsWith("sim");
  // ADR-011: retirada não recebe o acréscimo de domingo/feriado. Cobre "Retirada" (LPU) e
  // "Retirada Condomínio" (grupo de cabeamento, ADR-009) via prefixo normalizado.
  const isRetirada = !!finalidadeKey && finalidadeKey.startsWith("retirada");

  // Improdutiva padrão (Unetvale = R$ 15,98): repassa R$ 15,00 fixos e já sai APROVADA,
  // independente da classificação do motivo. Exige técnico mapeado — sem técnico não há a
  // quem pagar, então cai no fluxo normal (o fechamento sinaliza a visita sem técnico).
  if (
    !isSucesso &&
    !manualDecisionExists &&
    visit.tecnicoId &&
    isImprodutivaPadrao(visit.valorRecebidoUnetvale)
  ) {
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: improdutivaValor,
      valorDeixadoNaMesa: 0,
      status: "approved",
      improdutivaAprovada: true,
      acrescimoDomFeriado: null,
    };
  }

  // Improdutiva com Unetvale = R$ 0,00: a Unetvale não reembolsou (típico de falha do técnico).
  // Payout R$ 0,00 e sai da fila (improdutivaAprovada = false = decisão automática de não pagar).
  // Preserva o "deixado na mesa" quando o motivo é falha do técnico, para o relatório.
  if (!isSucesso && !manualDecisionExists && isUnetvaleZero(visit.valorRecebidoUnetvale)) {
    const reason = visit.reasonId ? reasons.find((r) => r.id === visit.reasonId) : undefined;
    const deixadoNaMesa = reason ? calculateDeixadoNaMesa(visit, rules, reason) : 0;
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: 0,
      valorDeixadoNaMesa: deixadoNaMesa,
      status: "pending_review",
      improdutivaAprovada: false,
      acrescimoDomFeriado: null,
    };
  }

  // ADR-011: +pct% sobre execução com sucesso em domingo/feriado (não vale p/ improdutiva
  // nem para retirada). Como este portão gateia `comAcrescimo`, a exclusão de retirada vale
  // para todos os caminhos (LPU, cabeamento, homologação, Venda Produto Externo).
  const aplicaAcrescimo =
    isSucesso &&
    !isRetirada &&
    !!feriado &&
    isDomingoOuFeriado(visit.dataExecucao, feriado.feriados);
  // ADR-019: a LPU pode ter percentual próprio; sem ele vale o do tenant. A LISTA de feriados
  // continua sendo do tenant — o calendário é o mesmo para todo mundo, só o percentual muda.
  const feriadoPct = lpuValores?.feriadoPct ?? feriado?.pct ?? 0;
  const comAcrescimo = (valor: number | null): number | null =>
    valor != null && valor > 0 && aplicaAcrescimo
      ? aplicarAcrescimo(valor, feriadoPct)
      : valor;
  // ADR-011: valor em R$ que o acréscimo somou (null quando não incide), a partir do MESMO
  // valor-base passado a `comAcrescimo`. Persistido para a tela exibir a quebra base → +pct%.
  // Arredondado a 2 casas para casar com numeric(10,2) e reconciliar (base = calculado − acréscimo).
  const acrescimoDe = (base: number | null): number | null =>
    base != null && base > 0 && aplicaAcrescimo
      ? Math.round((aplicarAcrescimo(base, feriadoPct) - base) * 100) / 100
      : null;

  // ADR-016: acréscimo por pontos adicionais (coluna Z). Homologação NÃO passa por aqui —
  // retorna antes, com o repasse (inclusive ponto) vindo do próprio mapa (ADR-015).
  const acrescimoPontos =
    parsePontosAdicionais(visit.explicacaoValor) * pontoAdicionalValor;
  const comPontos = (base: number | null): number | null =>
    base != null ? base + acrescimoPontos : null;

  // ADR-016: Unetvale = R$ 29,30 → não paga o técnico (roteador agregado). Curto-circuito
  // antes da LPU/classificação, para qualquer finalidade com sucesso.
  if (isSucesso && isUnetvaleNaoPaga(visit.valorRecebidoUnetvale)) {
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: 0,
      valorDeixadoNaMesa: 0,
      status: "pending_review",
      improdutivaAprovada: null,
      acrescimoDomFeriado: null,
    };
  }

  // ADR-015: homologação (explicacao_valor começa com "Homologa...") → repasse fixo
  // por valor da Unetvale, NÃO pela regra de LPU da finalidade. Precede a LPU porque a
  // finalidade ("Instalação - Fibra", "Mudança Endereço Fibra") também casa regras de
  // instalação real. Valor não cadastrado → no_rule_match (surge na fila do gestor).
  if (homologacao && isSucesso && isHomologacao(visit.explicacaoValor)) {
    const cents =
      visit.valorRecebidoUnetvale != null
        ? Math.round(visit.valorRecebidoUnetvale * 100)
        : null;
    const valor = cents != null ? homologacao.valores.get(cents) : undefined;
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: comAcrescimo(valor ?? null),
      valorDeixadoNaMesa: 0,
      status: valor != null ? "pending_review" : "no_rule_match",
      improdutivaAprovada: null,
      acrescimoDomFeriado: acrescimoDe(valor ?? null),
    };
  }

  // ADR-016: "Venda Produto Externo" — o serviço real está na coluna Z (Roteador, Cabeamento
  // agregado), não na finalidade. Precede a LPU (que pagaria R$ 0 para essa finalidade).
  if (isSucesso && visit.finalidade?.trim() === "Venda Produto Externo") {
    const base = resolveVendaProdutoExterno(visit.explicacaoValor);
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      valorCalculado: comAcrescimo(comPontos(base)),
      valorDeixadoNaMesa: 0,
      status: base != null ? "pending_review" : "no_rule_match",
      improdutivaAprovada: null,
      acrescimoDomFeriado: acrescimoDe(comPontos(base)),
    };
  }

  if (isGrupo && isSucesso) {
    const valor = classification!.map.get(normalizeExplicacao(visit.explicacaoValor));
    return {
      tenantId,
      visitId: visit.id,
      technicianId: visit.tecnicoId,
      lpuId,
      lpuRuleId: null,
      reasonId: visit.reasonId,
      // ADR-016: valor-base da classificação + acréscimo por pontos adicionais.
      valorCalculado: comAcrescimo(comPontos(valor ?? null)),
      valorDeixadoNaMesa: 0,
      status: valor != null ? "pending_review" : "no_rule_match",
      improdutivaAprovada: null,
      acrescimoDomFeriado: acrescimoDe(comPontos(valor ?? null)),
    };
  }

  const reasonMap = new Map(reasons.map((r) => [r.id, r]));
  const reason = visit.reasonId ? reasonMap.get(visit.reasonId) : undefined;

  const result = calculatePayout(visit, rules, reason);

  let deixadoNaMesa = result.deixadoNaMesa;
  if (reason && result.status === "pending" && result.valor === 0) {
    deixadoNaMesa = calculateDeixadoNaMesa(visit, rules, reason);
  }

  return {
    tenantId,
    visitId: visit.id,
    technicianId: visit.tecnicoId,
    lpuId,
    lpuRuleId: result.ruleId,
    reasonId: visit.reasonId,
    // ADR-016: instalação/condomínio via LPU + acréscimo por pontos adicionais (só p/ sucesso;
    // improdutiva não tem ponto na coluna Z, então acrescimoPontos = 0 de qualquer forma).
    valorCalculado: comAcrescimo(isSucesso ? comPontos(result.valor) : result.valor),
    valorDeixadoNaMesa: deixadoNaMesa,
    status: mapStatus(result.status),
    improdutivaAprovada: null,
    acrescimoDomFeriado: acrescimoDe(isSucesso ? comPontos(result.valor) : result.valor),
  };
}
