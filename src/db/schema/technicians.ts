import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * Tabela `technicians` — técnicos de campo.
 *
 * Espelha exatamente a migration 0001_initial_schema.sql.
 * A relação com `users` é inversa: `users.technician_id → technicians.id`.
 * Não existe `user_id` nesta tabela.
 */
export const technicians = pgTable(
  "technicians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    nomeCompleto: text("nome_completo").notNull(),
    email: text("email").notNull(),
    cpf: text("cpf"),
    celular: text("celular"),
    codigoUnetvale: text("codigo_unetvale"),
    // LPU específica do técnico (ADR-014). NULL = usa a LPU padrão ativa do tenant.
    // FK para lpus(id) definida na migration 0023 — não declarada com .references()
    // aqui para evitar ciclo de import (users → technicians → lpus → users).
    lpuId: uuid("lpu_id"),
    ativo: boolean("ativo").notNull().default(true),
    dataAdmissao: date("data_admissao"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_technicians_tenant_email").on(
      table.tenantId,
      table.email,
    ),
    uniqueIndex("uq_technicians_tenant_cpf").on(table.tenantId, table.cpf),
    uniqueIndex("uq_technicians_tenant_codigo").on(
      table.tenantId,
      table.codigoUnetvale,
    ),
    index("idx_technicians_tenant")
      .on(table.tenantId)
      .where(sql`ativo = true`),
    index("idx_technicians_nome_normalizado").on(
      table.tenantId,
      sql`lower(immutable_unaccent(nome_completo))`,
    ),
  ],
);

/** Tipo inferido de um technician — SELECT */
export type Technician = typeof technicians.$inferSelect;

/** Tipo inferido de um technician — INSERT */
export type NewTechnician = typeof technicians.$inferInsert;
