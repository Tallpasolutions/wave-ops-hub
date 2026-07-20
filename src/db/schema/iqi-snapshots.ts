import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { technicians } from "./technicians";

/**
 * Tabela `iqi_snapshots` — snapshots mensais do Indicador IQI (ADR-012).
 *
 * Espelha exatamente a migration 0020_iqi_snapshots.sql.
 * Um registro por (tenant, técnico, competência). Escrita só pelo coletor
 * (service role); leitura por gestor/supervisor/técnico conforme RLS.
 */
export const iqiSnapshots = pgTable(
  "iqi_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tecnicoId: uuid("tecnico_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    competencia: text("competencia").notNull(),
    totalOs: integer("total_os").notNull(),
    contratosReincidentes: integer("contratos_reincidentes").notNull(),
    pctReincidencia: numeric("pct_reincidencia", {
      precision: 5,
      scale: 2,
    }).notNull(),
    osNums: jsonb("os_nums"),
    tiposServico: text("tipos_servico").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_iqi_tenant_tecnico_competencia").on(
      table.tenantId,
      table.tecnicoId,
      table.competencia,
    ),
    index("idx_iqi_tenant_competencia").on(table.tenantId, table.competencia),
    index("idx_iqi_tenant_tecnico").on(table.tenantId, table.tecnicoId),
  ],
);

/** Tipo inferido de um snapshot de IQI — SELECT */
export type IqiSnapshot = typeof iqiSnapshots.$inferSelect;

/** Tipo inferido de um snapshot de IQI — INSERT */
export type NewIqiSnapshot = typeof iqiSnapshots.$inferInsert;
