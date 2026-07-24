import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { technicians } from "./technicians";
import { serviceVisits } from "./service-visits";
import { lpus } from "./lpus";
import { lpuRules } from "./lpu-rules";
import { reasons } from "./reasons";
import { monthlyClosings } from "./monthly-closings";

export type PayoutStatus =
  | "pending_calculation"
  | "pending_review"
  | "pending"
  | "approved"
  | "paid"
  | "contestado"
  | "override"
  | "no_rule_match"
  | "pending_classification"
  | "conflict";

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id")
      .notNull()
      .unique()
      .references(() => serviceVisits.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id").references(() => technicians.id, {
      onDelete: "set null",
    }),
    lpuId: uuid("lpu_id").references(() => lpus.id, { onDelete: "set null" }),
    lpuRuleId: uuid("lpu_rule_id").references(() => lpuRules.id, {
      onDelete: "set null",
    }),
    reasonId: uuid("reason_id").references(() => reasons.id, {
      onDelete: "set null",
    }),
    improdutivaAprovada: boolean("improdutiva_aprovada"),
    valorCalculado: numeric("valor_calculado", { precision: 10, scale: 2 }),
    // ADR-011: valor em R$ somado pelo acréscimo de domingo/feriado (null = não incidiu).
    acrescimoDomFeriado: numeric("acrescimo_dom_feriado", { precision: 10, scale: 2 }),
    valorDeixadoNaMesa: numeric("valor_deixado_na_mesa", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    status: text("status").notNull().$type<PayoutStatus>(),
    valorOverride: numeric("valor_override", { precision: 10, scale: 2 }),
    overrideMotivo: text("override_motivo"),
    overrideBy: uuid("override_by").references(() => users.id),
    overrideAt: timestamp("override_at", { withTimezone: true }),
    closingId: uuid("closing_id").references(() => monthlyClosings.id, {
      onDelete: "set null",
    }),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_payouts_tenant_status").on(table.tenantId, table.status),
    index("idx_payouts_closing").on(table.closingId),
  ],
);

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;

export const payoutsAudit = pgTable(
  "payouts_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    before: text("before").notNull(),
    after: text("after").notNull(),
  },
  (table) => [
    index("idx_payouts_audit_payout").on(table.payoutId, table.changedAt),
  ],
);

export type PayoutAudit = typeof payoutsAudit.$inferSelect;
