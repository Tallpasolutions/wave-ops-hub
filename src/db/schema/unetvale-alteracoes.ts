import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { technicians } from "./technicians";
import { serviceVisits } from "./service-visits";
import { uploads } from "./uploads";
import { users } from "./users";

/**
 * Alterações de valor feitas pela Unetvale DEPOIS de já ter informado outro (ADR-021).
 *
 * Escopo: abertura de OS de garantia, que é quando a Unetvale reduz o que paga por um serviço
 * já executado. A detecção sai de `service_visits_audit` (fato objetivo: a receita mudou entre
 * duas ingestões) e a classificação vem do texto da observação mais a assinatura numérica da
 * redução — ver `src/lib/etl/alteracoes.ts`.
 *
 * `payout_anterior` é o snapshot ANTES do recálculo e `payout_novo` o valor depois: é a diferença
 * entre os dois que decide se o técnico é notificado — receita da Unetvale ele não vê, pontos sim.
 */
export const unetvaleAlteracoes = pgTable(
  "unetvale_alteracoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => serviceVisits.id, { onDelete: "cascade" }),
    osNum: integer("os_num").notNull(),
    // Desnormalizado de propósito: é por ele que a RLS do técnico filtra, sem join.
    technicianId: uuid("technician_id").references(() => technicians.id, {
      onDelete: "set null",
    }),
    uploadId: uuid("upload_id").references(() => uploads.id, {
      onDelete: "set null",
    }),
    observacaoUnetvale: text("observacao_unetvale"),
    receitaAnterior: numeric("receita_anterior", { precision: 10, scale: 2 }),
    receitaNova: numeric("receita_nova", { precision: 10, scale: 2 }),
    payoutAnterior: numeric("payout_anterior", { precision: 10, scale: 2 }),
    payoutNovo: numeric("payout_novo", { precision: 10, scale: 2 }),
    cientePor: uuid("ciente_por").references(() => users.id),
    cienteEm: timestamp("ciente_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Detecção idempotente: reprocessar o mesmo upload não duplica registro.
    uniqueIndex("uq_unetvale_alt_visita_upload").on(
      table.visitId,
      table.uploadId,
      table.receitaAnterior,
      table.receitaNova,
    ),
    index("idx_unetvale_alt_visita").on(table.visitId),
    index("idx_unetvale_alt_tecnico").on(table.technicianId),
  ],
);

export type UnetvaleAlteracao = typeof unetvaleAlteracoes.$inferSelect;
export type NewUnetvaleAlteracao = typeof unetvaleAlteracoes.$inferInsert;
