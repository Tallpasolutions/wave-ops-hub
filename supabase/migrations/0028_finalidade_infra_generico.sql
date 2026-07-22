-- =============================================================================
-- 0028 — "Infra Genérico" (e "Infra Parcial") no filtro de finalidades de infra (ADR-008)
--
-- A lista de 0013 tinha "Genérico" e "Parcial" SEM o prefixo, mas o dado da Unetvale
-- vem como "Infra Genérico" — o match é exato (trim+lower), então a OS passava pelo
-- filtro e aparecia (ex.: OS 560133 como no_rule_match no fechamento). Adiciona os
-- nomes reais; "Infra Parcial" incluída pela mesma intenção do ADR (ainda sem dado).
--
-- O ETL de upload lê `config.finalidades_infra` (ingestor.ts), então uploads futuros
-- de "Infra Genérico" já saem marcados. Esta migration cobre os dados existentes.
--
-- Aplicar via Supabase SQL Editor. Idempotente. Ver docs/architecture/ADR-008.
-- =============================================================================

-- 1. Atualiza a lista de finalidades de infra (mantém as antigas + adiciona os prefixadas)
UPDATE tenants
SET config = jsonb_set(
  config,
  '{finalidades_infra}',
  '["Manutenção Infra","Manutenção Programada","Ativação Infra","Troca de postes","Massiva","Adequação de Rede","Projeto Infra","Viabilidade Infra","Notificação Celesc","Genérico","Parcial","Infra Genérico","Infra Parcial"]'::jsonb,
  true
)
WHERE slug = 'wave';

-- 2. Marca as visitas existentes cujas finalidades agora são de infra (match normalizado)
UPDATE service_visits sv
SET fora_escopo = true
FROM tenants t
WHERE sv.tenant_id = t.id
  AND sv.fora_escopo = false
  AND lower(btrim(sv.finalidade)) IN (
    SELECT lower(btrim(x)) FROM jsonb_array_elements_text(t.config -> 'finalidades_infra') AS x
  );

-- 3. Remove payouts das visitas de infra recém-marcadas (não approved/paid, por segurança)
DELETE FROM payouts p
USING service_visits sv
WHERE p.visit_id = sv.id
  AND sv.fora_escopo = true
  AND p.status NOT IN ('approved', 'paid');

-- Controle: "Infra Genérico" restante fora do escopo (esperado: 0 com fora_escopo=false)
SELECT 'Infra Genérico ainda no escopo' AS etapa, count(*) AS total
FROM service_visits sv
JOIN tenants t ON t.id = sv.tenant_id
WHERE t.slug = 'wave'
  AND lower(btrim(sv.finalidade)) = 'infra genérico'
  AND sv.fora_escopo = false;
