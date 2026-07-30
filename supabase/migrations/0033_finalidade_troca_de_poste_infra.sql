-- =============================================================================
-- 0033 — "Troca de Poste" entra nas finalidades de infra (ADR-008)
--
-- A decisão da Wave (03/07/2026, Sprint 12) já incluía troca de poste na lista de infra,
-- e a 0013 gravou o item como **"Troca de postes"** (plural). A planilha da Unetvale traz
-- a finalidade no singular: **"Troca de Poste"**. O match é por texto normalizado
-- (`lower(btrim(...))`, ver ingestor.ts), então singular ≠ plural: as visitas nunca foram
-- marcadas `fora_escopo` e apareciam em /pagamentos como "Sem regra".
--
-- Confirmação de que são infra de terceiro, não trabalho do técnico de campo — a coluna Z
-- das 3 visitas afetadas (OS 575578, 575598, 575759, todas de 25-26/07/2026):
--   "OS infra feita por terceirizada (0 cordoalhas * 165 + 0 metros de cabo * 2 + ...)"
--
-- O item antigo "Troca de postes" fica na lista de propósito: é inofensivo (nunca casa) e
-- protege caso a Unetvale volte a emitir no plural.
--
-- Não altera schema. FORMA DE EXECUÇÃO: SQL Editor do Supabase. Idempotente.
-- Não precisa de "Recalcular pendentes": o passo 3 remove os payouts, e o recálculo pula
-- visitas `fora_escopo` (recalculate-batch.ts).
-- =============================================================================

-- 1. Acrescenta a variante no singular (concatena — não sobrescreve itens adicionados depois
--    da 0013, como "Infra Genérico"/"Infra Parcial")
UPDATE tenants
SET config = jsonb_set(
  config,
  '{finalidades_infra}',
  (config -> 'finalidades_infra') || '["Troca de Poste"]'::jsonb
)
WHERE slug = 'wave'
  AND NOT (config -> 'finalidades_infra' @> '["Troca de Poste"]'::jsonb);

-- 2. Backfill das visitas existentes (mesma comparação normalizada da 0013)
UPDATE service_visits sv
SET fora_escopo = true
FROM tenants t
WHERE sv.tenant_id = t.id
  AND sv.fora_escopo = false
  AND lower(btrim(sv.finalidade)) IN (
    SELECT lower(btrim(x)) FROM jsonb_array_elements_text(t.config -> 'finalidades_infra') AS x
  );

-- 3. Remove os payouts dessas visitas (infra não gera pagamento).
--    approved/paid ficam preservados — se sobrar algum, o diagnóstico abaixo acusa.
DELETE FROM payouts p
USING service_visits sv
WHERE p.visit_id = sv.id
  AND sv.fora_escopo = true
  AND p.status NOT IN ('approved', 'paid');

-- ── Conferência 1: nenhuma visita de infra pode ficar com payout travado. Esperado: 0 ──────
SELECT 'infra com payout approved/paid (revisar)' AS etapa, count(*) AS total
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
WHERE sv.fora_escopo = true AND p.status IN ('approved', 'paid');

-- ── Conferência 2: as finalidades de infra e quantas visitas cada uma marcou ───────────────
-- Esperado: "Troca de Poste" com 3 visitas, todas fora_escopo = true.
SELECT sv.finalidade, count(*) AS visitas, bool_and(sv.fora_escopo) AS todas_fora_escopo
FROM service_visits sv
JOIN tenants t ON t.id = sv.tenant_id
WHERE lower(btrim(sv.finalidade)) IN (
  SELECT lower(btrim(x)) FROM jsonb_array_elements_text(t.config -> 'finalidades_infra') AS x
)
GROUP BY sv.finalidade
ORDER BY visitas DESC;

-- ── Conferência 3: o que sobra em "Sem regra" depois desta migration ───────────────────────
-- Esperado: 4 — 3 homologações com valor da Unetvale não cadastrado (R$ 0,00 e R$ 3,96) e
-- 1 suporte externo sem meio preenchido (OS 573797). Nenhuma é infra.
SELECT sv.os_num, sv.data_execucao::date AS data, sv.finalidade,
       sv.tipo_atendimento, sv.subterraneo_aereo AS meio,
       sv.valor_recebido_unetvale AS receita, left(sv.explicacao_valor, 40) AS explicacao_z
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
WHERE p.status = 'no_rule_match'
ORDER BY sv.data_execucao;
