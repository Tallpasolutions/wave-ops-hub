import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { technicians } from "./technicians";
import { uploads } from "./uploads";
import { reasons } from "./reasons";

export type TipoAtendimento = "Externo" | "Interno";

/**
 * Tabela `service_visits` — uma linha da planilha = uma visita.
 *
 * Chave de idempotência: `content_hash` (SHA-256 do conteúdo da linha).
 * Unique natural: (tenant_id, os_num, data_execucao, tecnico_id).
 * Para visitas sem técnico vinculado, o índice parcial
 * `idx_visit_unique_no_match` (criado em 0001 via SQL raw) garante unicidade
 * por (tenant_id, os_num, data_execucao, tecnico_raw) WHERE tecnico_id IS NULL.
 * Esse índice parcial não é declarável no Drizzle — existe apenas no banco.
 */
export const serviceVisits = pgTable(
  "service_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    osNum: bigint("os_num", { mode: "number" }).notNull(),
    uploadId: uuid("upload_id").references(() => uploads.id, {
      onDelete: "set null",
    }),
    dataExecucao: timestamp("data_execucao", { withTimezone: true }).notNull(),
    tecnicoId: uuid("tecnico_id").references(() => technicians.id, {
      onDelete: "set null",
    }),
    tecnicoRaw: text("tecnico_raw").notNull(),
    reasonId: uuid("reason_id").references(() => reasons.id, {
      onDelete: "set null",
    }),
    finalidade: text("finalidade"),
    tipoAtendimento: text("tipo_atendimento").$type<TipoAtendimento | null>(),
    cidade: text("cidade"),
    sucesso: text("sucesso").notNull(),
    improdutiva: boolean("improdutiva").default(false),
    valorRecebidoUnetvale: numeric("valor_recebido_unetvale", {
      precision: 10,
      scale: 2,
    }),
    dropUsado: numeric("drop_usado", { precision: 10, scale: 2 }),
    faixaDrop: text("faixa_drop"),
    conectoresUsados: integer("conectores_usados"),
    condominio: boolean("condominio").default(false),
    subterraneaAereo: text("subterraneo_aereo"),
    garantia: boolean("garantia").default(false),
    validada: boolean("validada").default(false),
    agregada: boolean("agregada").default(false),
    rejeitada: boolean("rejeitada").default(false),
    agendada: boolean("agendada").default(false),
    trocadoDrop: boolean("trocado_drop").default(false),
    motivoTroca: text("motivo_troca"),
    outrasFibras: boolean("outras_fibras").default(false),
    quantasFibras: integer("quantas_fibras"),
    categoriaInterna: text("categoria_interna"),
    cat1: text("cat1"),
    cat2: text("cat2"),
    cat3: text("cat3"),
    explicacaoValor: text("explicacao_valor"),
    observacoes: text("observacoes"),
    numTecnicos: integer("num_tecnicos"),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_visits_tenant_os_data_tecnico").on(
      table.tenantId,
      table.osNum,
      table.dataExecucao,
      table.tecnicoId,
    ),
    index("idx_visits_tenant_data").on(table.tenantId, table.dataExecucao),
    index("idx_visits_tenant_tecnico").on(table.tenantId, table.tecnicoId),
    index("idx_visits_tenant_os").on(table.tenantId, table.osNum),
    index("idx_visits_tenant_sucesso").on(table.tenantId, table.sucesso),
    index("idx_visits_pendentes_vinculo")
      .on(table.tenantId)
      .where(sql`tecnico_id IS NULL`),
  ],
);

export type ServiceVisit = typeof serviceVisits.$inferSelect;
export type NewServiceVisit = typeof serviceVisits.$inferInsert;
