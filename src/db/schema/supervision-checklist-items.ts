import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Template do checklist de supervisão de campo, configurável pelo gestor por tenant (ADR-022).
 *
 * Este é o MOLDE, não o histórico. Ao agendar uma supervisão, a Server Action copia os itens
 * ativos para `supervision_answers`, com título, peso e ordem denormalizados — editar ou
 * desativar um item aqui é invisível para supervisão já agendada.
 *
 * O CRUD NUNCA faz DELETE: desativar é `ativo = false`. Isso preserva a FK das respostas
 * históricas e o rastro de qual item originou cada resposta.
 *
 * `peso` é 1 por padrão, então a nota é a proporção simples de itens conformes. O campo existe
 * para o gestor tornar um item crítico sem que a fórmula precise mudar depois.
 */
export const supervisionChecklistItems = pgTable(
  "supervision_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Código curto opcional ("EPI-01") para o gestor referenciar em treinamento.
    codigo: text("codigo"),
    titulo: text("titulo").notNull(),
    descricao: text("descricao"),
    // Agrupador livre na UI ("Segurança", "Qualidade da emenda", "Atendimento").
    categoria: text("categoria"),
    peso: numeric("peso", { precision: 6, scale: 2 }).notNull().default("1"),
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Código único por tenant quando informado, case-insensitive. Parcial: NULL fica livre.
    uniqueIndex("uq_sup_item_codigo")
      .on(table.tenantId, sql`lower(${table.codigo})`)
      .where(sql`${table.codigo} IS NOT NULL`),
    // A query quente: itens ativos do tenant, na ordem (montagem do snapshot).
    index("idx_sup_items_tenant_ordem")
      .on(table.tenantId, table.ordem)
      .where(sql`${table.ativo}`),
    check("chk_sup_item_peso_positivo", sql`${table.peso} > 0`),
    check(
      "chk_sup_item_titulo_nao_vazio",
      sql`length(btrim(${table.titulo})) > 0`,
    ),
  ],
);

export type SupervisionChecklistItem =
  typeof supervisionChecklistItems.$inferSelect;
export type NewSupervisionChecklistItem =
  typeof supervisionChecklistItems.$inferInsert;
