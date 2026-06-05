import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

export type ReasonCategoria =
  | "falha_tecnico"
  | "falha_cliente"
  | "forca_maior"
  | "falha_sistema"
  | "pendente_classificacao";

export const reasons = pgTable(
  "reasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    motivoOriginal: text("motivo_original").notNull(),
    motivoNormalizado: text("motivo_normalizado").notNull(),
    categoria: text("categoria").$type<ReasonCategoria>().notNull(),
    pagaImprodutiva: boolean("paga_improdutiva").notNull().default(false),
    valorImprodutiva: numeric("valor_improdutiva", { precision: 10, scale: 2 }),
    observacao: text("observacao"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_reasons_tenant_motivo").on(
      table.tenantId,
      table.motivoOriginal,
    ),
    index("idx_reasons_tenant_categoria").on(table.tenantId, table.categoria),
    index("idx_reasons_pendentes")
      .on(table.tenantId)
      .where(sql`categoria = 'pendente_classificacao'`),
  ],
);

export type Reason = typeof reasons.$inferSelect;
export type NewReason = typeof reasons.$inferInsert;
