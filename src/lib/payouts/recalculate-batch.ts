import type { SupabaseClient } from "@supabase/supabase-js";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import { buildPayoutUpsert, type FeriadoCtx } from "./calculate";
import type { BatchRecalcResult, ChunkRecalcResult } from "./types";

// Sem paginação explícita o PostgREST corta silenciosamente em 1000 linhas — visitas além
// disso nunca eram recalculadas, e um `.in()` com 1000+ UUIDs estoura o limite de URL.
// Todo acesso a visitas aqui é paginado/particionado neste tamanho.
export const RECALC_CHUNK_SIZE = 200;

const VISIT_COLUMNS =
  "id, os_num, tecnico_id, reason_id, finalidade, tipo_atendimento, sucesso, cidade, condominio, drop_usado, faixa_drop, conectores_usados, garantia, subterraneo_aereo, valor_recebido_unetvale, agregada, explicacao_valor, data_execucao";

type VisitRow = {
  id: string;
  os_num: number | string;
  tecnico_id: string | null;
  reason_id: string | null;
  finalidade: string | null;
  tipo_atendimento: string | null;
  sucesso: string | null;
  cidade: string | null;
  condominio: boolean | null;
  drop_usado: number | string | null;
  faixa_drop: string | null;
  conectores_usados: number | null;
  garantia: boolean | null;
  subterraneo_aereo: string | null;
  valor_recebido_unetvale: number | string | null;
  agregada: boolean | null;
  explicacao_valor: string | null;
  data_execucao: string;
};

function rowToSimVisit(v: VisitRow): SimVisit {
  return {
    id: v.id,
    osNum: Number(v.os_num),
    tecnicoId: v.tecnico_id,
    reasonId: v.reason_id,
    finalidade: v.finalidade,
    tipoAtendimento: v.tipo_atendimento as "Externo" | "Interno" | null,
    sucesso: v.sucesso ?? "",
    cidade: v.cidade ?? "",
    condominio: v.condominio ?? false,
    dropUsado: v.drop_usado != null ? Number(v.drop_usado) : null,
    faixaDrop: v.faixa_drop,
    conectoresUsados: v.conectores_usados,
    garantia: v.garantia ?? false,
    subterraneaAereo: v.subterraneo_aereo,
    agregada: v.agregada ?? false,
    valorRecebidoUnetvale:
      v.valor_recebido_unetvale != null
        ? Number(v.valor_recebido_unetvale)
        : null,
    explicacaoValor: v.explicacao_valor,
    dataExecucao: v.data_execucao,
  };
}

// Extrai o período YYYY-MM de uma data ISO
function toPeriodo(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error(`chunkArray: size deve ser >= 1 (recebido ${size})`);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type RecalcContext = {
  lpuId: string | null;
  rules: LpuRuleNarrowed[];
  // ADR-014: LPU por técnico. technicianId → { lpuId, rules } quando o técnico tem
  // uma LPU atribuída (technicians.lpu_id). Ausente = usa a LPU padrão acima.
  lpuByTecnico: Map<string, { lpuId: string; rules: LpuRuleNarrowed[] }>;
  reasons: ReasonForPayout[];
  // ADR-009: classificação de Cabeamento/Condomínio (explicacao_key → valor) + grupo de
  // finalidades (normalizado trim+lower). Mapa vazio/set vazio → comportamento igual ao anterior.
  classifications: Map<string, number>;
  finalidadesClassificar: Set<string>;
  // ADR-011: acréscimo de domingo/feriado (config do tenant). pct 0 / lista vazia = no-op.
  feriado: FeriadoCtx;
};

async function loadRecalcContext(
  tenantId: string,
  supabase: SupabaseClient,
): Promise<RecalcContext> {
  const { data: lpuData } = await supabase
    .from("lpus")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("ativa", true)
    .single();

  const lpuId = lpuData?.id ?? null;
  let rules: LpuRuleNarrowed[] = [];

  if (lpuId) {
    const { data: rulesRaw } = await supabase
      .from("lpu_rules")
      .select("*")
      .eq("lpu_id", lpuId)
      .eq("ativa", true);
    rules = (rulesRaw ?? []) as LpuRuleNarrowed[];
  }

  // ADR-014: LPUs atribuídas a técnicos específicos (technicians.lpu_id). Carrega as
  // regras de cada LPU alternativa uma vez e mapeia technicianId → { lpuId, rules }.
  const lpuByTecnico = new Map<string, { lpuId: string; rules: LpuRuleNarrowed[] }>();
  const { data: assignedTechs } = await supabase
    .from("technicians")
    .select("id, lpu_id")
    .eq("tenant_id", tenantId)
    .not("lpu_id", "is", null);
  const altLpuIds = [
    ...new Set((assignedTechs ?? []).map((t) => t.lpu_id as string)),
  ];
  const rulesByLpu = new Map<string, LpuRuleNarrowed[]>();
  for (const altLpuId of altLpuIds) {
    const { data: altRules } = await supabase
      .from("lpu_rules")
      .select("*")
      .eq("lpu_id", altLpuId)
      .eq("ativa", true);
    rulesByLpu.set(altLpuId, (altRules ?? []) as LpuRuleNarrowed[]);
  }
  for (const t of assignedTechs ?? []) {
    const altLpuId = t.lpu_id as string;
    lpuByTecnico.set(t.id as string, {
      lpuId: altLpuId,
      rules: rulesByLpu.get(altLpuId) ?? [],
    });
  }

  const { data: reasonsRaw } = await supabase
    .from("reasons")
    .select("id, categoria, paga_improdutiva, valor_improdutiva")
    .eq("tenant_id", tenantId);

  const reasons: ReasonForPayout[] = (reasonsRaw ?? []).map((r) => ({
    id: r.id,
    categoria: r.categoria,
    pagaImprodutiva: r.paga_improdutiva,
    valorImprodutiva:
      r.valor_improdutiva != null ? Number(r.valor_improdutiva) : null,
  }));

  // ADR-009: classificações de Cabeamento/Condomínio + finalidades do grupo
  const { data: classRaw } = await supabase
    .from("cabeamento_classifications")
    .select("explicacao_key, valor")
    .eq("tenant_id", tenantId);
  const classifications = new Map<string, number>(
    (classRaw ?? []).map((c) => [c.explicacao_key as string, Number(c.valor)]),
  );

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("config")
    .eq("id", tenantId)
    .single();
  const cfg = (tenantRow?.config ?? {}) as {
    finalidades_classificar_explicacao?: unknown;
    feriados?: unknown;
    feriado_acrescimo_pct?: unknown;
  };
  const finalidadesClassificar = new Set(
    (Array.isArray(cfg.finalidades_classificar_explicacao)
      ? cfg.finalidades_classificar_explicacao
      : []
    ).map((f) => String(f).trim().toLowerCase()),
  );

  // ADR-011: feriados (datas "YYYY-MM-DD") + percentual do acréscimo
  const feriado: FeriadoCtx = {
    feriados: new Set(
      (Array.isArray(cfg.feriados) ? cfg.feriados : []).map((d) => String(d).slice(0, 10)),
    ),
    pct: typeof cfg.feriado_acrescimo_pct === "number" ? cfg.feriado_acrescimo_pct : 0,
  };

  return { lpuId, rules, lpuByTecnico, reasons, classifications, finalidadesClassificar, feriado };
}

type PageResult = {
  processed: number;
  skipped: number;
  errors: number;
  periodos: Set<string>;
};

// Processa UMA página de visitas (<= RECALC_CHUNK_SIZE): detecta payouts travados
// (approved/paid nunca são recalculados — invariante da Sprint 4), calcula e faz upsert.
async function processVisitPage(
  visits: VisitRow[],
  ctx: RecalcContext,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<PageResult> {
  const periodos = new Set<string>();
  if (visits.length === 0) return { processed: 0, skipped: 0, errors: 0, periodos };

  const { data: existingPayouts, error: payoutsError } = await supabase
    .from("payouts")
    .select("visit_id, status, improdutiva_aprovada, override_by")
    .in("visit_id", visits.map((v) => v.id));

  if (payoutsError) return { processed: 0, skipped: 0, errors: 1, periodos };

  // Payouts que o recálculo NUNCA reprocessa — preserva status E valor:
  //  - approved/paid: fechados/pagos (invariante da Sprint 4);
  //  - contestado: contestação aberta do técnico (ADR-013). Reprocessar resetaria para
  //    pending_review e apagaria o sinal de contestação. Ao resolver, a Wave volta o payout
  //    para 'pending' (destravado), então volta a reprocessar normalmente.
  //  - override_by preenchido: override/rejeição MANUAL do gestor. Reprocessar sobrescreveria o
  //    status (ex.: improdutiva rejeitada reprocessada pela LPU vira no_rule_match e trava o
  //    fechamento, apesar do valor_override manter R$0). Os fluxos de "desfazer"/reabertura
  //    limpam override_by ANTES de recalcular, então continuam reprocessando normalmente.
  const lockedVisitIds = new Set(
    (existingPayouts ?? [])
      .filter(
        (p) =>
          p.status === "approved" ||
          p.status === "paid" ||
          p.status === "contestado" ||
          p.override_by !== null,
      )
      .map((p) => p.visit_id),
  );

  // O upsert sempre grava improdutiva_aprovada. Quando o cálculo não emite decisão automática
  // (null), preservamos o valor existente para não apagar a decisão do gestor.
  const existingAprovadaByVisit = new Map(
    (existingPayouts ?? []).map((p) => [p.visit_id, p.improdutiva_aprovada as boolean | null]),
  );

  const toProcess = visits.filter((v) => !lockedVisitIds.has(v.id));
  const skipped = visits.length - toProcess.length;

  if (toProcess.length === 0) return { processed: 0, skipped, errors: 0, periodos };

  const upserts = toProcess.map((v) => {
    // ADR-014: usa a LPU atribuída ao técnico, se houver; senão a padrão do tenant.
    const assigned = v.tecnico_id ? ctx.lpuByTecnico.get(v.tecnico_id) : undefined;
    return buildPayoutUpsert(
      rowToSimVisit(v),
      assigned?.rules ?? ctx.rules,
      ctx.reasons,
      assigned?.lpuId ?? ctx.lpuId,
      tenantId,
      { map: ctx.classifications, finalidades: ctx.finalidadesClassificar },
      ctx.feriado,
    );
  });

  const { error: upsertError } = await supabase.from("payouts").upsert(
    upserts.map((u) => ({
      tenant_id: u.tenantId,
      visit_id: u.visitId,
      technician_id: u.technicianId,
      lpu_id: u.lpuId,
      lpu_rule_id: u.lpuRuleId,
      reason_id: u.reasonId,
      valor_calculado: u.valorCalculado,
      valor_deixado_na_mesa: u.valorDeixadoNaMesa,
      status: u.status,
      improdutiva_aprovada:
        u.improdutivaAprovada ?? existingAprovadaByVisit.get(u.visitId) ?? null,
    })),
    { onConflict: "visit_id" },
  );

  if (upsertError) return { processed: 0, skipped, errors: 1, periodos };

  for (const v of toProcess) periodos.add(toPeriodo(v.data_execucao));
  return { processed: toProcess.length, skipped, errors: 0, periodos };
}

async function ensureMonthlyClosings(
  periodos: Set<string>,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<void> {
  for (const periodo of periodos) {
    await supabase.from("monthly_closings").upsert(
      { tenant_id: tenantId, periodo, status: "aberto" },
      { onConflict: "tenant_id,periodo", ignoreDuplicates: true },
    );
  }
}

export async function recalculatePendingPayouts(
  tenantId: string,
  supabase: SupabaseClient,
  options?: { visitIds?: string[]; periodo?: string },
): Promise<BatchRecalcResult> {
  const ctx = await loadRecalcContext(tenantId, supabase);

  const totals: BatchRecalcResult = { processed: 0, skipped: 0, errors: 0 };
  const periodos = new Set<string>();

  const accumulate = (page: PageResult) => {
    totals.processed += page.processed;
    totals.skipped += page.skipped;
    totals.errors += page.errors;
    page.periodos.forEach((p) => periodos.add(p));
  };

  if (options?.visitIds && options.visitIds.length > 0) {
    for (const idChunk of chunkArray(options.visitIds, RECALC_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("service_visits")
        .select(VISIT_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("fora_escopo", false)
        .in("id", idChunk);
      if (error) {
        totals.errors += 1;
        continue;
      }
      accumulate(await processVisitPage((data ?? []) as VisitRow[], ctx, tenantId, supabase));
    }
  } else {
    let offset = 0;
    for (;;) {
      let query = supabase
        .from("service_visits")
        .select(VISIT_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("fora_escopo", false);

      if (options?.periodo) {
        const [year, month] = options.periodo.split("-").map(Number);
        query = query
          .gte("data_execucao", `${options.periodo}-01`)
          .lt("data_execucao", new Date(year, month, 1).toISOString().slice(0, 10));
      }

      const { data, error } = await query
        .order("id")
        .range(offset, offset + RECALC_CHUNK_SIZE - 1);

      if (error) {
        totals.errors += 1;
        break;
      }
      const page = (data ?? []) as VisitRow[];
      if (page.length === 0) break;

      accumulate(await processVisitPage(page, ctx, tenantId, supabase));

      if (page.length < RECALC_CHUNK_SIZE) break;
      offset += RECALC_CHUNK_SIZE;
    }
  }

  await ensureMonthlyClosings(periodos, tenantId, supabase);
  return totals;
}

// Versão interativa: processa UMA página por chamada, para o botão "Recalcular pendentes"
// iterar em várias invocações curtas de Server Action (evita o timeout/503 da invocação única)
// exibindo progresso real.
export async function recalculatePendingPayoutsChunk(
  tenantId: string,
  supabase: SupabaseClient,
  offset: number,
): Promise<ChunkRecalcResult> {
  const { count } = await supabase
    .from("service_visits")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("fora_escopo", false);
  const total = count ?? 0;

  const ctx = await loadRecalcContext(tenantId, supabase);

  const { data, error } = await supabase
    .from("service_visits")
    .select(VISIT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("fora_escopo", false)
    .order("id")
    .range(offset, offset + RECALC_CHUNK_SIZE - 1);

  if (error) {
    return { processed: 0, skipped: 0, errors: 1, total, nextOffset: offset, hasMore: false };
  }

  const page = (data ?? []) as VisitRow[];
  const result = await processVisitPage(page, ctx, tenantId, supabase);
  await ensureMonthlyClosings(result.periodos, tenantId, supabase);

  const nextOffset = offset + page.length;
  return {
    processed: result.processed,
    skipped: result.skipped,
    errors: result.errors,
    total,
    nextOffset,
    hasMore: page.length === RECALC_CHUNK_SIZE && nextOffset < total,
  };
}
