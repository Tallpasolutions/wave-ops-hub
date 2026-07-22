import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Repasse de Homologação por valor da Unetvale (ADR-015).
 *
 * Homologação é identificada pela coluna Z (`explicacao_valor` começa com
 * "Homologa..."), não pela finalidade — a mesma finalidade de instalação pode
 * ser uma instalação real (regra de LPU) ou uma homologação (repasse fixo). O
 * repasse varia com o valor que a Unetvale pagou, e o caso "dobrado" tem a MESMA
 * explicação da base, então a chave é o `valor_unetvale`, não o texto. O gestor
 * mantém o mapa; o cálculo de payout reusa o valor. Espelha
 * `cabeamento_classifications`.
 */
export const homologacaoClassifications = pgTable(
  "homologacao_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Valor que a Unetvale pagou (coluna de receita) — chave de lookup do repasse.
    valorUnetvale: numeric("valor_unetvale", { precision: 10, scale: 2 }).notNull(),
    // Payout do técnico para homologações com esse valor da Unetvale.
    valorRepasse: numeric("valor_repasse", { precision: 10, scale: 2 }).notNull(),
    observacao: text("observacao"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_homologacao_class_tenant_valor").on(
      table.tenantId,
      table.valorUnetvale,
    ),
    index("idx_homologacao_class_tenant").on(table.tenantId),
  ],
);

export type HomologacaoClassification =
  typeof homologacaoClassifications.$inferSelect;
export type NewHomologacaoClassification =
  typeof homologacaoClassifications.$inferInsert;
