import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

// Tipos base para JSONB — serão narrowados em src/lib/lpu/types.ts na Etapa 3
export type LpuConditions = Record<string, unknown>;
export type PayoutType = "fixed" | "formula" | "percentage_of_revenue";
export type LpuPayout = { type: PayoutType } & Record<string, unknown>;

export const lpus = pgTable(
  "lpus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    vigenciaInicio: date("vigencia_inicio").notNull(),
    vigenciaFim: date("vigencia_fim"),
    ativa: boolean("ativa").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Partial index: apenas LPUs ativas por tenant (enforce_single_active_lpu via trigger)
    index("idx_lpus_tenant_ativa").on(table.tenantId).where(sql`ativa = true`),
    index("idx_lpus_tenant_vigencia").on(table.tenantId, table.vigenciaInicio),
  ],
);

export type Lpu = typeof lpus.$inferSelect;
export type NewLpu = typeof lpus.$inferInsert;
