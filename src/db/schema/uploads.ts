import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export type UploadStatus = "pending" | "processing" | "success" | "failed" | "duplicate";

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    storagePath: text("storage_path").notNull(),
    status: text("status").$type<UploadStatus>().notNull(),
    periodoInicio: date("periodo_inicio"),
    periodoFim: date("periodo_fim"),
    totalLinhas: integer("total_linhas").notNull().default(0),
    inseridas: integer("inseridas").notNull().default(0),
    atualizadas: integer("atualizadas").notNull().default(0),
    ignoradas: integer("ignoradas").notNull().default(0),
    erros: integer("erros").notNull().default(0),
    errorLog: jsonb("error_log"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_uploads_tenant_hash").on(table.tenantId, table.fileHash),
    index("idx_uploads_tenant_status").on(table.tenantId, table.status),
    index("idx_uploads_tenant_uploaded").on(table.tenantId, table.uploadedAt),
  ],
);

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
