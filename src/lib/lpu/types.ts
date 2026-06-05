import type { LpuRule } from "@/db/schema";

export type VisitForMatch = {
  finalidade: string | null;
  tipoAtendimento: "Externo" | "Interno" | null;
  sucesso: string;
  cidade: string;
  condominio: boolean;
  dropUsado: number | null;
  faixaDrop: string | null;
  conectoresUsados: number | null;
  garantia: boolean;
  subterraneaAereo: string | null;
  valorRecebidoUnetvale: number | null;
};

export type ConditionValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | { min?: number; max?: number };

export type PayoutFixed = { type: "fixed"; value: number };

export type PayoutFormula = {
  type: "formula";
  base: number;
  additional: { field: keyof VisitForMatch; ratePerUnit: number };
};

export type PayoutPercentage = {
  type: "percentage_of_revenue";
  percentage: number;
};

export type PayoutNarrowed = PayoutFixed | PayoutFormula | PayoutPercentage;

export type LpuRuleNarrowed = Omit<LpuRule, "conditions" | "payout"> & {
  conditions: Partial<Record<keyof VisitForMatch, ConditionValue>>;
  payout: PayoutNarrowed;
};

export type MatchResult =
  | { type: "no_match" }
  | { type: "conflict"; rules: LpuRuleNarrowed[] }
  | { type: "match"; rule: LpuRuleNarrowed };

export type ReasonForPayout = {
  id: string;
  categoria:
    | "falha_tecnico"
    | "falha_cliente"
    | "forca_maior"
    | "falha_sistema"
    | "pendente_classificacao";
  pagaImprodutiva: boolean;
  valorImprodutiva: number | null;
};

export type PayoutStatus =
  | "pending"
  | "no_rule_match"
  | "conflict"
  | "pending_classification";

export type PayoutResult = {
  valor: number | null;
  ruleId: string | null;
  status: PayoutStatus;
  deixadoNaMesa: number;
};

export type TecnicoSummary = {
  tecnicoId: string | null;
  total: number;
  visitas: number;
};

export type VisitSimulationDetail = {
  visitId: string;
  osNum: number;
  finalidade: string | null;
  sucesso: string;
};

export type SimulationResult = {
  totalVisitas: number;
  visitasComRegra: number;
  visitasSemRegra: number;
  visitasConflito: number;
  visitasPendentes: number;
  totalEstimadoPagar: number;
  receitaTotal: number;
  margem: number;
  distribuicaoPorTecnico: TecnicoSummary[];
  visitasSemRegraDetalhes: VisitSimulationDetail[];
};

export type ConflictGroup = {
  prioridade: number;
  rules: LpuRuleNarrowed[];
};
