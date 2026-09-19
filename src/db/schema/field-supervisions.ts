import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { technicians } from "./technicians";
import { users } from "./users";

export const SUPERVISION_STATUSES = [
  "agendada",
  // O supervisor saiu para o local (migration 0045). Registrável, não obrigatório: quem já
  // está lá precisa conseguir começar a vistoria mesmo sem marcar a saída.
  "em_deslocamento",
  "em_execucao",
  "concluida",
  "cancelada",
] as const;

export const SUPERVISION_PARECERES = [
  "aprovado",
  "aprovado_com_ressalvas",
  "reprovado",
  "reciclagem_recomendada",
] as const;

/**
 * Supervisão de campo: o gestor agenda (técnico + data + supervisor) e o supervisor executa
 * em campo pelo celular (ADR-022).
 *
 * ISOLADA DO CÁLCULO. Nada aqui entra em payout, LPU, ETL, dashboard, ranking, contagem ou
 * fechamento. O isolamento é estrutural: como o módulo nunca escreve em `service_visits` nem
 * em `payouts`, os triggers de `consolidar_service_order()` nunca são invocados.
 *
 * O técnico supervisionado NÃO vê a supervisão dele — as políticas RLS destas tabelas não têm
 * ramo `tenant_technician`, ao contrário do template canônico do projeto.
 *
 * `nota` é CONGELADA na conclusão, nunca recalculada em leitura — mesmo princípio de
 * `payouts.valor_calculado`. `null` significa "sem item avaliável", não zero.
 */
export const fieldSupervisions = pgTable(
  "field_supervisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // tecnico_id em PORTUGUÊS: casa com service_visits e iqi_snapshots. Nome errado de coluna
    // faz o PostgREST devolver vazio em silêncio.
    tecnicoId: uuid("tecnico_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    // users.id do supervisor (NÃO technicians.id): é por ele que a RLS filtra, comparando
    // direto com auth.uid(), sem join. FK nomeada no SQL (fk_field_sup_supervisor) porque a
    // tabela tem 3 FKs para users e o embed do PostgREST ficaria ambíguo.
    supervisorUserId: uuid("supervisor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    agendadaPor: uuid("agendada_por").references(() => users.id, {
      onDelete: "set null",
    }),
    canceladaPor: uuid("cancelada_por").references(() => users.id, {
      onDelete: "set null",
    }),

    status: text("status").notNull().default("agendada"),
    // DATE e não timestamp: "dia da supervisão" não tem hora, e timestamptz com
    // toLocaleDateString gera off-by-one de um dia em America/Sao_Paulo.
    dataAgendada: date("data_agendada").notNull(),
    localReferencia: text("local_referencia"),

    // MERAMENTE INFORMATIVO, sem chave estrangeira de propósito: é a anotação de qual OS o
    // técnico estava executando durante a supervisão. Não vincula, não entra na consolidação
    // e não afeta total_visitas.
    osNumReferencia: integer("os_num_referencia"),

    observacoesGestor: text("observacoes_gestor"),
    deslocamentoIniciadoEm: timestamp("deslocamento_iniciado_em", {
      withTimezone: true,
    }),
    // Chegou ao local. Separado de `iniciadaEm`: a diferença entre os dois é o tempo de
    // preparação no local.
    chegadaEm: timestamp("chegada_em", { withTimezone: true }),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true }),
    concluidaEm: timestamp("concluida_em", { withTimezone: true }),
    canceladaEm: timestamp("cancelada_em", { withTimezone: true }),
    motivoCancelamento: text("motivo_cancelamento"),

    parecerFinal: text("parecer_final"),
    parecerObservacao: text("parecer_observacao"),

    nota: numeric("nota", { precision: 5, scale: 2 }),
    // Impressão geral do supervisor, de 1 a 10 (migration 0044, vindo da ficha de EPI).
    // NÃO se confunde com `nota`: uma é julgamento, a outra é medida do checklist.
    notaQualidadeTecnica: integer("nota_qualidade_tecnica"),
    // Contratante da visita. TEXT com CHECK em vez de enum: a lista muda com contrato novo.
    empresa: text("empresa"),
    // Região da operação. Texto livre: a lista de clusters é da Unetvale e muda sem aviso.
    cluster: text("cluster"),
    notaCalculadaEm: timestamp("nota_calculada_em", { withTimezone: true }),
    // Contadores denormalizados: a lista do gestor não precisa agregar as respostas.
    itensTotal: integer("itens_total"),
    itensConformes: integer("itens_conformes"),
    itensNaoConformes: integer("itens_nao_conformes"),
    itensNaoAplica: integer("itens_nao_aplica"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_field_sup_tenant_status").on(
      table.tenantId,
      table.status,
      table.dataAgendada.desc(),
    ),
    index("idx_field_sup_supervisor").on(
      table.supervisorUserId,
      table.status,
      table.dataAgendada.desc(),
    ),
    index("idx_field_sup_tecnico").on(
      table.tenantId,
      table.tecnicoId,
      table.dataAgendada.desc(),
    ),
    index("idx_field_sup_os_ref")
      .on(table.tenantId, table.osNumReferencia)
      .where(sql`${table.osNumReferencia} IS NOT NULL`),
    check(
      "chk_field_sup_status",
      sql`${table.status} IN ('agendada', 'em_deslocamento', 'em_execucao', 'concluida', 'cancelada')`,
    ),
    check(
      "chk_field_sup_parecer",
      sql`${table.parecerFinal} IS NULL OR ${table.parecerFinal} IN ('aprovado', 'aprovado_com_ressalvas', 'reprovado', 'reciclagem_recomendada')`,
    ),
    check(
      "chk_field_sup_qualidade",
      sql`${table.notaQualidadeTecnica} IS NULL OR (${table.notaQualidadeTecnica} >= 1 AND ${table.notaQualidadeTecnica} <= 10)`,
    ),
    check(
      "chk_field_sup_empresa",
      sql`${table.empresa} IS NULL OR ${table.empresa} IN ('unifique', 'unetvale')`,
    ),
    check(
      "chk_field_sup_nota_faixa",
      sql`${table.nota} IS NULL OR (${table.nota} >= 0 AND ${table.nota} <= 100)`,
    ),
    // Concluída sempre tem parecer e timestamp. A nota pode ser NULL (todos "não se aplica").
    check(
      "chk_field_sup_concluida_completa",
      sql`${table.status} <> 'concluida' OR (${table.concluidaEm} IS NOT NULL AND ${table.parecerFinal} IS NOT NULL)`,
    ),
    check(
      "chk_field_sup_cancelada_completa",
      sql`${table.status} <> 'cancelada' OR ${table.canceladaEm} IS NOT NULL`,
    ),
  ],
);

export type FieldSupervision = typeof fieldSupervisions.$inferSelect;
export type NewFieldSupervision = typeof fieldSupervisions.$inferInsert;
