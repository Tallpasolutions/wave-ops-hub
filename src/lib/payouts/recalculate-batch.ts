import type { SupabaseClient } from "@supabase/supabase-js";
import type { LpuRuleNarrowed, ReasonForPayout } from "@/lib/lpu/types";
import type { SimVisit } from "@/lib/lpu/simulator";
import { buildPayoutUpsert } from "./calculate";
import type { BatchRecalcResult } from "./types";

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
    valorRecebidoUnetvale:
      v.valor_recebido_unetvale != null
        ? Number(v.valor_recebido_unetvale)
        : null,
  };
}

// Extrai o período YYYY-MM de uma data ISO
function toPeriodo(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export async function recalculatePendingPayouts(
  tenantId: string,
  supabase: SupabaseClient,
  options?: { visitIds?: string[]; periodo?: string },
): Promise<BatchRecalcResult> {
  // 1. Buscar LPU ativa + regras
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

  // 2. Buscar reasons do tenant
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

  // 3. Buscar visitas a processar (excluindo as com payouts aprovados/pagos)
  let visitsQuery = supabase
    .from("service_visits")
    .select(
      "id, os_num, tecnico_id, reason_id, finalidade, tipo_atendimento, sucesso, cidade, condominio, drop_usado, faixa_drop, conectores_usados, garantia, subterraneo_aereo, valor_recebido_unetvale, data_execucao",
    )
    .eq("tenant_id", tenantId);

  if (options?.visitIds && options.visitIds.length > 0) {
    visitsQuery = visitsQuery.in("id", options.visitIds);
  } else if (options?.periodo) {
    const [year, month] = options.periodo.split("-").map(Number);
    const inicio = `${options.periodo}-01`;
    const fimExclusivo = new Date(year, month, 1).toISOString().slice(0, 10);
    visitsQuery = visitsQuery
      .gte("data_execucao", inicio)
      .lt("data_execucao", fimExclusivo);
  }

  const { data: visitsRaw, error: visitsError } = await visitsQuery;
  if (visitsError || !visitsRaw || visitsRaw.length === 0) {
    return { processed: 0, skipped: 0, errors: visitsError ? 1 : 0 };
  }

  // 4. Buscar payouts existentes para detectar quais estão travados (approved/paid)
  const visitIds = visitsRaw.map((v) => v.id);
  const { data: existingPayouts } = await supabase
    .from("payouts")
    .select("visit_id, status")
    .in("visit_id", visitIds);

  const lockedVisitIds = new Set(
    (existingPayouts ?? [])
      .filter((p) => p.status === "approved" || p.status === "paid")
      .map((p) => p.visit_id),
  );

  // 5. Calcular payouts para visitas não travadas
  const toProcess = (visitsRaw as VisitRow[]).filter(
    (v) => !lockedVisitIds.has(v.id),
  );
  const skipped = visitsRaw.length - toProcess.length;

  if (toProcess.length === 0) {
    return { processed: 0, skipped, errors: 0 };
  }

  const upserts = toProcess.map((v) =>
    buildPayoutUpsert(rowToSimVisit(v), rules, reasons, lpuId, tenantId),
  );

  // 6. Upsert em batch
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
    })),
    { onConflict: "visit_id" },
  );

  if (upsertError) {
    return { processed: 0, skipped, errors: 1 };
  }

  // 7. Criar monthly_closing para cada período encontrado (idempotente)
  const periodos = [...new Set(toProcess.map((v) => toPeriodo(v.data_execucao)))];
  for (const periodo of periodos) {
    await supabase.from("monthly_closings").upsert(
      { tenant_id: tenantId, periodo, status: "aberto" },
      { onConflict: "tenant_id,periodo", ignoreDuplicates: true },
    );
  }

  return { processed: toProcess.length, skipped, errors: 0 };
}
