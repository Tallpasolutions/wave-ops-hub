import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { lpus, type LpuConditions, type LpuPayout } from "./lpus";
import { users } from "./users";

export const lpuRules = pgTable(
  "lpu_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lpuId: uuid("lpu_id")
      .notNull()
      .references(() => lpus.id, { onDelete: "cascade" }),
    prioridade: integer("prioridade").notNull(),
    conditions: jsonb("conditions").notNull().$type<LpuConditions>(),
    payout: jsonb("payout").notNull().$type<LpuPayout>(),
    description: text("description").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_lpu_rules_lpu_prioridade")
      .on(table.lpuId, table.prioridade)
      .where(sql`ativa = true`),
  ],
);

export type LpuRule = typeof lpuRules.$inferSelect;
export type NewLpuRule = typeof lpuRules.$inferInsert;

export const lpuRulesAudit = pgTable(
  "lpu_rules_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => lpuRules.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    before: jsonb("before").notNull().$type<Record<string, unknown>>(),
    after: jsonb("after").notNull().$type<Record<string, unknown>>(),
  },
  (table) => [
    index("idx_lpu_rules_audit_rule").on(table.ruleId, table.changedAt),
  ],
);

export type LpuRuleAudit = typeof lpuRulesAudit.$inferSelect;
