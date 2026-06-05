import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Tabela `tenants` — entidades de plataforma (clientes da Tallpa).
 *
 * Espelha exatamente a migration 0001_initial_schema.sql.
 * Colunas em snake_case no banco, propriedades em camelCase no TypeScript.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nome: text("nome").notNull(),
    dominioCustom: text("dominio_custom").unique(),
    brandPath: text("brand_path").notNull(),
    plano: text("plano").notNull().default("starter"),
    config: jsonb("config")
      .notNull()
      .default(
        sql`'{"show_money_on_technician_panel": true, "auto_create_reasons": true}'::jsonb`,
      ),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tenants_slug").on(table.slug).where(sql`ativo = true`),
    index("idx_tenants_dominio_custom")
      .on(table.dominioCustom)
      .where(sql`dominio_custom IS NOT NULL`),
    check(
      "slug_format",
      sql`slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 32`,
    ),
  ],
);

/** Tipo inferido de um tenant — SELECT */
export type Tenant = typeof tenants.$inferSelect;

/** Tipo inferido de um tenant — INSERT */
export type NewTenant = typeof tenants.$inferInsert;
