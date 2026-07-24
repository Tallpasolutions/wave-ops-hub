import type { PayoutStatus as DbPayoutStatusRaw, ClosingStatus } from "@/db/schema";

// Re-exports para uso no restante da lib
export type { ClosingStatus };
export type DbPayoutStatus = DbPayoutStatusRaw;

export type PayoutUpsertData = {
  tenantId: string;
  visitId: string;
  technicianId: string | null;
  lpuId: string | null;
  lpuRuleId: string | null;
  reasonId: string | null;
  valorCalculado: number | null;
  valorDeixadoNaMesa: number;
  status: DbPayoutStatus;
  // true → improdutiva padrão auto-aprovada (Unetvale 15,98 → 15,00 fixos); null → sem decisão
  // automática, preserva a decisão manual existente no upsert.
  improdutivaAprovada: boolean | null;
  // ADR-011: valor em R$ efetivamente somado pelo acréscimo de domingo/feriado (null quando não
  // incide). Persistido para a tela mostrar "base → +pct% → total" sem depender da config atual.
  acrescimoDomFeriado: number | null;
};

export type BatchRecalcResult = {
  processed: number;
  skipped: number;
  errors: number;
};

export type ChunkRecalcResult = BatchRecalcResult & {
  total: number;
  nextOffset: number;
  hasMore: boolean;
};

export type ClosingBlockers = {
  noRuleMatch: number;
  pendingClassification: number;
  conflict: number;
  semTecnico: number;
};

export type ClosingValidation =
  | { valid: true }
  | { valid: false; blockers: ClosingBlockers };

export type ClosingTotals = {
  totalAPagar: number;
  totalReceitaUnetvale: number;
  margem: number;
  totalVisitas: number;
};

// Tipo mínimo de payout que as funções de closing precisam
export type PayoutForClosing = {
  id: string;
  status: DbPayoutStatus;
  valorCalculado: string | null;
  valorOverride: string | null;
  valorRecebidoUnetvale?: string | null;
};
