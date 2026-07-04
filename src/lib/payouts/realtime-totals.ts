import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { buildClosingTotals } from "./closing";
import type { DbPayoutStatus } from "./types";

type RealtimePayoutRow = {
  status: string;
  valor_calculado: string | null;
  valor_override: string | null;
};

// O snapshot em monthly_closings (total_a_pagar / total_visitas) só é preenchido
// na aprovação. Fechamentos não consolidados (aberto / aguardando_aprovacao /
// reaberto) precisam do cálculo em tempo real — mesma base que a página de
// detalhe usa para exibir os KPIs.
export async function computeRealtimeClosingTotals(
  supabase: SupabaseClient,
  tenantId: string,
  periodo: string,
): Promise<{ totalAPagar: number; totalVisitas: number }> {
  const [y, m] = periodo.split("-").map(Number);
  const periodoFim = new Date(y, m, 1).toISOString().slice(0, 10);

  // service_visits!inner: sem o !inner, o gte/lt filtra apenas o embed e a query
  // retorna payouts de TODOS os períodos (cortados em 1000 pelo PostgREST).
  const { rows } = await fetchAllPages<RealtimePayoutRow>((from, to) =>
    supabase
      .from("payouts")
      .select(
        "status, valor_calculado, valor_override, service_visits!inner(data_execucao)",
      )
      .eq("tenant_id", tenantId)
      .gte("service_visits.data_execucao" as never, `${periodo}-01`)
      .lt("service_visits.data_execucao" as never, periodoFim)
      .order("id")
      .range(from, to),
  );

  const totals = buildClosingTotals(
    rows.map((p) => ({
      id: "",
      status: p.status as DbPayoutStatus,
      valorCalculado: p.valor_calculado,
      valorOverride: p.valor_override,
    })),
    [],
  );

  return { totalAPagar: totals.totalAPagar, totalVisitas: totals.totalVisitas };
}
