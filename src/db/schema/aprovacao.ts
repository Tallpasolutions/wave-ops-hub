import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { technicians } from "./technicians";
import { payouts } from "./payouts";
import { users } from "./users";

/**
 * `closing_technician_reviews` — estado da revisão de um período por técnico
 * (Sprint 18). Espelha a migration 0022.
 */
export const closingTechnicianReviews = pgTable(
  "closing_technician_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .default("pendente")
      .$type<"pendente" | "aprovado" | "contestado">(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_ctr_tenant_periodo_tecnico").on(
      table.tenantId,
      table.periodo,
      table.technicianId,
    ),
    index("idx_ctr_tenant_periodo").on(table.tenantId, table.periodo),
  ],
);

/**
 * `payout_contestacoes` — contestações individuais de payout (Sprint 18).
 * Espelha a migration 0022.
 */
export const payoutContestacoes = pgTable(
  "payout_contestacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
    motivo: text("motivo").notNull(),
    status: text("status")
      .notNull()
      .default("aberta")
      .$type<"aberta" | "resolvida">(),
    respostaGestor: text("resposta_gestor"),
    // ADR-013: valor efetivo do payout antes/depois da resolução (a Wave pode ajustar
    // o valor daquela OS ao responder). Técnico vê a pontuação anterior → atual.
    valorAnterior: numeric("valor_anterior", { precision: 10, scale: 2 }),
    valorNovo: numeric("valor_novo", { precision: 10, scale: 2 }),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_contestacoes_tenant_periodo").on(table.tenantId, table.periodo),
    index("idx_contestacoes_payout").on(table.payoutId),
    uniqueIndex("uq_contestacao_aberta_por_payout")
      .on(table.payoutId)
      .where(sql`status = 'aberta'`),
  ],
);

export type ClosingTechnicianReview = typeof closingTechnicianReviews.$inferSelect;
export type NewClosingTechnicianReview = typeof closingTechnicianReviews.$inferInsert;
export type PayoutContestacao = typeof payoutContestacoes.$inferSelect;
export type NewPayoutContestacao = typeof payoutContestacoes.$inferInsert;
