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
import { tenants } from "./tenants";

export type ServiceOrderStatus =
  | "aberta"
  | "em_andamento"
  | "resolvida"
  | "cancelada";

/**
 * Tabela `service_orders` — ordens de serviço consolidadas.
 *
 * Campos de agregação (total_visitas, tentativas_ate_sucesso, custo_total,
 * receita_total, status_consolidado, data_resolucao) são mantidos pelo trigger
 * `consolidar_service_order()` — nunca escrever manualmente nesses campos.
 */
export const serviceOrders = pgTable(
  "service_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    osNum: bigint("os_num", { mode: "number" }).notNull(),
    inicioSistema: timestamp("inicio_sistema", { withTimezone: true }),
    clienteUsuario: text("cliente_usuario"),
    contrato: text("contrato"),
    finalidade: text("finalidade"),
    cidade: text("cidade"),
    condominio: boolean("condominio").default(false),
    cat1: text("cat1"),
    cat2: text("cat2"),
    cat3: text("cat3"),
    statusConsolidado: text("status_consolidado")
      .$type<ServiceOrderStatus>()
      .notNull()
      .default("em_andamento"),
    dataResolucao: timestamp("data_resolucao", { withTimezone: true }),
    totalVisitas: integer("total_visitas").notNull().default(0),
    tentativasAteSucesso: integer("tentativas_ate_sucesso"),
    custoTotal: numeric("custo_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    receitaTotal: numeric("receita_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_so_tenant_osnum").on(table.tenantId, table.osNum),
    index("idx_so_tenant_status").on(table.tenantId, table.statusConsolidado),
    index("idx_so_tenant_data").on(table.tenantId, table.dataResolucao),
    index("idx_so_tenant_finalidade").on(table.tenantId, table.finalidade),
    index("idx_so_tenant_cidade").on(table.tenantId, table.cidade),
  ],
);

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type NewServiceOrder = typeof serviceOrders.$inferInsert;
