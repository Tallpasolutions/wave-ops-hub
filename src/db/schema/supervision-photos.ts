import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { fieldSupervisions } from "./field-supervisions";
import { supervisionAnswers } from "./supervision-answers";

/**
 * Evidências fotográficas da supervisão, no bucket privado `supervisao-fotos` (ADR-022).
 *
 * `uploadedEm` fica nulo até o browser confirmar o PUT na signed URL. TODA leitura filtra
 * `uploaded_em IS NOT NULL`: uma linha criada cujo upload foi abortado vira lixo invisível,
 * nunca uma foto quebrada na tela. O índice parcial `idx_sup_photos_orfas` prepara a purga
 * dessas linhas.
 *
 * `answerId` nulo = foto geral da supervisão; preenchido = evidência de um item específico.
 */
export const supervisionPhotos = pgTable(
  "supervision_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supervisaoId: uuid("supervisao_id")
      .notNull()
      .references(() => fieldSupervisions.id, { onDelete: "cascade" }),
    // Desnormalizado pela mesma razão de supervision_answers: RLS sem join.
    supervisorUserId: uuid("supervisor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    answerId: uuid("answer_id").references(() => supervisionAnswers.id, {
      onDelete: "cascade",
    }),

    // Path no bucket: <tenant_id>/<supervisao_id>/<uuid>.jpg
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    tamanhoBytes: integer("tamanho_bytes"),
    legenda: text("legenda"),
    enviadaPor: uuid("enviada_por").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedEm: timestamp("uploaded_em", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sup_photos_supervisao")
      .on(table.supervisaoId, table.createdAt)
      .where(sql`${table.uploadedEm} IS NOT NULL`),
    index("idx_sup_photos_answer")
      .on(table.answerId)
      .where(sql`${table.answerId} IS NOT NULL`),
    index("idx_sup_photos_supervisor").on(table.supervisorUserId),
    // Fila de limpeza de órfãs (linha criada, PUT nunca confirmado).
    index("idx_sup_photos_orfas")
      .on(table.tenantId, table.createdAt)
      .where(sql`${table.uploadedEm} IS NULL`),
    unique("uq_sup_photo_path").on(table.storagePath),
  ],
);

export type SupervisionPhoto = typeof supervisionPhotos.$inferSelect;
export type NewSupervisionPhoto = typeof supervisionPhotos.$inferInsert;
