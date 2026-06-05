import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export type ClosingStatus =
  | "aberto"
  | "aguardando_aprovacao"
  | "aprovado"
  | "pago"
  | "reaberto";

export const monthlyClosings = pgTable(
  "monthly_closings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
    status: text("status").notNull().$type<ClosingStatus>(),
    totalAPagar: numeric("total_a_pagar", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalReceitaUnetvale: numeric("total_receita_unetvale", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    margem: numeric("margem", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalVisitas: integer("total_visitas").notNull().default(0),
    totalOss: integer("total_oss").notNull().default(0),
    aprovadoPor: uuid("aprovado_por").references(() => users.id),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
    reabertoPor: uuid("reaberto_por").references(() => users.id),
    reabertoEm: timestamp("reaberto_em", { withTimezone: true }),
    reabertoMotivo: text("reaberto_motivo"),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_closings_tenant_periodo_unique").on(
      table.tenantId,
      table.periodo,
    ),
    index("idx_closings_tenant_status").on(table.tenantId, table.status),
  ],
);

export type MonthlyClosing = typeof monthlyClosings.$inferSelect;
export type NewMonthlyClosing = typeof monthlyClosings.$inferInsert;
