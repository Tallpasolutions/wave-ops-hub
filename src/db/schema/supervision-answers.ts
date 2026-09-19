import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { fieldSupervisions } from "./field-supervisions";
import { supervisionChecklistItems } from "./supervision-checklist-items";

export const SUPERVISION_RESPOSTAS = [
  "conforme",
  "nao_conforme",
  // Equipamento existe mas está gasto (migration 0044, vindo da ficha de EPI). Conta como
  // falha na nota, igual a nao_conforme, e é contado à parte: as ações do gestor diferem.
  "necessita_troca",
  "nao_se_aplica",
] as const;

/**
 * Snapshot congelado do checklist no momento do agendamento, mais a resposta de cada item
 * (ADR-022).
 *
 * As colunas `item*` são uma CÓPIA do template, não uma referência. É isso que garante que
 * editar, reordenar ou desativar um item em `supervision_checklist_items` depois não altere
 * nenhuma supervisão já agendada — nem a nota dela. `itemId` existe só para rastreio, e é
 * `ON DELETE SET NULL` justamente porque a integridade da nota não depende dele.
 *
 * `resposta` nula = item pendente. Concluir a supervisão exige zero pendentes.
 */
export const supervisionAnswers = pgTable(
  "supervision_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supervisaoId: uuid("supervisao_id")
      .notNull()
      .references(() => fieldSupervisions.id, { onDelete: "cascade" }),
    // Desnormalizado de propósito: é por ele que a RLS do supervisor filtra, sem subquery em
    // field_supervisions. Mesma decisão de unetvale_alteracoes.technician_id.
    supervisorUserId: uuid("supervisor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    itemId: uuid("item_id").references(() => supervisionChecklistItems.id, {
      onDelete: "set null",
    }),

    // ── Snapshot do item ────────────────────────────────────────────────────────────────
    ordem: integer("ordem").notNull(),
    itemCodigo: text("item_codigo"),
    itemTitulo: text("item_titulo").notNull(),
    itemDescricao: text("item_descricao"),
    itemCategoria: text("item_categoria"),
    itemPeso: numeric("item_peso", { precision: 6, scale: 2 })
      .notNull()
      .default("1"),
    itemFotoObrigatoria: boolean("item_foto_obrigatoria").notNull().default(false),
    itemTipoResposta: text("item_tipo_resposta").notNull().default("conformidade"),

    resposta: text("resposta"),
    observacao: text("observacao"),
    respondidaEm: timestamp("respondida_em", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sup_answers_supervisao").on(table.supervisaoId, table.ordem),
    index("idx_sup_answers_supervisor").on(table.supervisorUserId),
    index("idx_sup_answers_item")
      .on(table.itemId)
      .where(sql`${table.itemId} IS NOT NULL`),
    // `ordem` é reatribuída sequencialmente no snapshot, então é única dentro da supervisão.
    // Chave estável para a UI e trava contra duplicar o mesmo item na mesma supervisão.
    unique("uq_sup_answer_ordem").on(table.supervisaoId, table.ordem),
    check(
      "chk_sup_answer_resposta",
      sql`${table.resposta} IS NULL OR ${table.resposta} IN ('conforme', 'nao_conforme', 'necessita_troca', 'nao_se_aplica')`,
    ),
    check(
      "chk_sup_answer_tipo_resposta",
      sql`${table.itemTipoResposta} IN ('conformidade', 'posse_epi', 'uso_epi')`,
    ),
    check("chk_sup_answer_peso_positivo", sql`${table.itemPeso} > 0`),
  ],
);

export type SupervisionAnswer = typeof supervisionAnswers.$inferSelect;
export type NewSupervisionAnswer = typeof supervisionAnswers.$inferInsert;
