import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { technicians } from "./technicians";

/**
 * Tabela `users` — usuários do sistema.
 *
 * Espelha exatamente a migration 0001_initial_schema.sql.
 * A PK `id` vem de `auth.users` do Supabase (não é auto-gerado).
 *
 * Constraints de integridade:
 * - tallpa_owner: tenant_id IS NULL, technician_id IS NULL
 * - tenant_owner/tenant_manager: tenant_id NOT NULL, technician_id IS NULL
 * - tenant_technician: tenant_id NOT NULL, technician_id NOT NULL
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // FK para auth.users — não gerenciado pelo Drizzle
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull().unique(),
    nomeCompleto: text("nome_completo").notNull(),
    role: text("role").notNull(),
    technicianId: uuid("technician_id").references(() => technicians.id, {
      onDelete: "set null",
    }),
    ativo: boolean("ativo").notNull().default(true),
    ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_users_tenant").on(table.tenantId).where(sql`ativo = true`),
    index("idx_users_role").on(table.role),
    index("idx_users_technician")
      .on(table.technicianId)
      .where(sql`technician_id IS NOT NULL`),
    check(
      "role_valid",
      sql`role IN ('tallpa_owner', 'tenant_owner', 'tenant_manager', 'tenant_technician', 'tenant_supervisor')`,
    ),
    check(
      "tenant_role_consistency",
      sql`(role = 'tallpa_owner' AND tenant_id IS NULL) OR (role IN ('tenant_owner', 'tenant_manager', 'tenant_technician', 'tenant_supervisor') AND tenant_id IS NOT NULL)`,
    ),
    check(
      "technician_role_consistency",
      sql`(role IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NOT NULL) OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)`,
    ),
  ],
);

/** Tipo inferido de um user — SELECT */
export type User = typeof users.$inferSelect;

/** Tipo inferido de um user — INSERT */
export type NewUser = typeof users.$inferInsert;
