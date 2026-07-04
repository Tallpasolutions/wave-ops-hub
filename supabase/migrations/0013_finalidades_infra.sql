-- 0013 — Exclusão de finalidades de infraestrutura do escopo de payout (ADR-008)
--
-- OSs das equipes de infraestrutura vêm na planilha da Unetvale mas não são pagas aos
-- técnicos de campo e não devem contabilizar em nada. Ver docs/architecture/ADR-008.
--
-- Executado no SQL Editor do Supabase (autocommit por statement). Idempotente: reexecutar
-- é seguro — a coluna usa IF NOT EXISTS e os UPDATEs são determinísticos.

-- 1. Coluna de exclusão
ALTER TABLE service_visits
  ADD COLUMN IF NOT EXISTS fora_escopo BOOLEAN NOT NULL DEFAULT false;

-- 2. Lista de finalidades de infra na config do tenant Wave (padrão dos flags existentes).
--    Match por texto normalizado (trim+lower) na etapa 3.
UPDATE tenants
SET config = jsonb_set(
  config,
  '{finalidades_infra}',
  '["Manutenção Infra","Manutenção Programada","Ativação Infra","Troca de postes","Massiva","Adequação de Rede","Projeto Infra","Viabilidade Infra","Notificação Celesc","Genérico","Parcial"]'::jsonb,
  true
)
WHERE slug = 'wave';

-- 3. Marca as visitas existentes cujas finalidades são de infra (comparação normalizada)
UPDATE service_visits sv
SET fora_escopo = true
FROM tenants t
WHERE sv.tenant_id = t.id
  AND lower(btrim(sv.finalidade)) IN (
    SELECT lower(btrim(x)) FROM jsonb_array_elements_text(t.config -> 'finalidades_infra') AS x
  );

-- 4. Remove payouts das visitas de infra (nunca deveriam ter gerado pagamento).
--    approved/paid ficam preservados por segurança — se houver algum, checar manualmente.
DELETE FROM payouts p
USING service_visits sv
WHERE p.visit_id = sv.id
  AND sv.fora_escopo = true
  AND p.status NOT IN ('approved', 'paid');

-- Diagnóstico: infra que ficou com payout approved/paid (não deletado). Esperado: 0.
SELECT 'infra com payout travado (revisar)' AS etapa, count(*) AS total
FROM payouts p JOIN service_visits sv ON sv.id = p.visit_id
WHERE sv.fora_escopo = true AND p.status IN ('approved', 'paid');

-- Contagem de controle (colar no doc da sprint — R2.4)
SELECT 'visitas marcadas fora_escopo' AS etapa, count(*) AS total
FROM service_visits WHERE fora_escopo = true;
