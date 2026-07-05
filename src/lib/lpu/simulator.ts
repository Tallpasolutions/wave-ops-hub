import { calculatePayout } from "./calculate-payout";
import type {
  LpuRuleNarrowed,
  ReasonForPayout,
  SimulationResult,
  TecnicoSummary,
  VisitForMatch,
  VisitSimulationDetail,
} from "./types";

export type SimVisit = VisitForMatch & {
  id: string;
  osNum: number;
  reasonId: string | null;
  // Coluna Z (ADR-009): usada só na classificação de Cabeamento; opcional para os
  // demais construtores de SimVisit (ex.: simulador) que não precisam dela.
  explicacaoValor?: string | null;
};

export function simulate(
  rules: LpuRuleNarrowed[],
  visitas: SimVisit[],
  reasons: ReasonForPayout[],
): SimulationResult {
  const reasonMap = new Map(reasons.map((r) => [r.id, r]));
  const tecnicoMap = new Map<string | null, TecnicoSummary>();

  let totalEstimadoPagar = 0;
  let receitaTotal = 0;
  let visitasComRegra = 0;
  let visitasSemRegra = 0;
  let visitasConflito = 0;
  let visitasPendentes = 0;
  const semRegraDetalhes: VisitSimulationDetail[] = [];

  for (const visita of visitas) {
    const reason = visita.reasonId
      ? reasonMap.get(visita.reasonId)
      : undefined;
    const result = calculatePayout(visita, rules, reason);

    if (result.status === "pending" && result.valor !== null) {
      visitasComRegra++;
      totalEstimadoPagar += result.valor;
      const existing = tecnicoMap.get(visita.tecnicoId);
      const entry = existing ?? {
        tecnicoId: visita.tecnicoId,
        total: 0,
        visitas: 0,
      };
      entry.total += result.valor;
      entry.visitas++;
      tecnicoMap.set(visita.tecnicoId, entry);
    } else if (result.status === "no_rule_match") {
      visitasSemRegra++;
      semRegraDetalhes.push({
        visitId: visita.id,
        osNum: visita.osNum,
        finalidade: visita.finalidade,
        sucesso: visita.sucesso,
      });
    } else if (result.status === "conflict") {
      visitasConflito++;
    } else if (result.status === "pending_classification") {
      visitasPendentes++;
    }

    receitaTotal += visita.valorRecebidoUnetvale ?? 0;
  }

  const margem = receitaTotal - totalEstimadoPagar;

  return {
    totalVisitas: visitas.length,
    visitasComRegra,
    visitasSemRegra,
    visitasConflito,
    visitasPendentes,
    totalEstimadoPagar,
    receitaTotal,
    margem,
    distribuicaoPorTecnico: [...tecnicoMap.values()].sort(
      (a, b) => b.total - a.total,
    ),
    visitasSemRegraDetalhes: semRegraDetalhes,
  };
}
