import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Classificação de payout de Cabeamento/Condomínio (ADR-009).
 *
 * Essas finalidades não têm regra de LPU porque o valor depende do serviço
 * específico descrito na coluna Z (`explicacao_valor`), no vocabulário da
 * Unetvale — que não mapeia por igualdade nem regex para a LPU (vocabulário da
 * Wave). O gestor classifica cada padrão distinto (agrupado por `explicacao_key`
 * normalizada) uma vez → o cálculo de payout reusa o valor. Espelha `reasons`.
 */
export const cabeamentoClassifications = pgTable(
  "cabeamento_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Coluna Z bruta (referência/auditoria).
    explicacaoOriginal: text("explicacao_original").notNull(),
    // Coluna Z normalizada (chave de agrupamento e lookup) — ver normalizeExplicacao.
    explicacaoKey: text("explicacao_key").notNull(),
    // Payout do técnico (valor da LPU) para este serviço.
    valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
    observacao: text("observacao"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_cabeamento_class_tenant_key").on(
      table.tenantId,
      table.explicacaoKey,
    ),
    index("idx_cabeamento_class_tenant").on(table.tenantId),
  ],
);

export type CabeamentoClassification =
  typeof cabeamentoClassifications.$inferSelect;
export type NewCabeamentoClassification =
  typeof cabeamentoClassifications.$inferInsert;
