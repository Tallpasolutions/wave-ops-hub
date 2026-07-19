-- 0019 — Reabre improdutivas rejeitadas em lote para a regra de improdutiva por receita
--
-- Um lote de improdutivas foi rejeitado manualmente (override valor 0) ANTES da regra de
-- improdutiva por receita da Unetvale (15,98 → R$15; 0 → R$0). Como tinham override manual,
-- o recálculo respeitava a decisão e não aplicava a regra nova; pior, ao reprocessar a
-- improdutiva pela LPU sem meio, o status virava 'no_rule_match', que BLOQUEIA o fechamento
-- mesmo valendo R$0. Decisão do gestor: reabrir essas visitas para a regra nova.
--
-- Esta migration limpa o override e volta o status para 'pending' apenas nas improdutivas
-- rejeitadas pelos fluxos padrão (motivos automáticos, sem justificativa própria do gestor),
-- e nunca em payouts já pagos ou em fechamento. Depois, "Recalcular pendentes" aplica a regra:
-- Unetvale 15,98 → R$15 aprovado; Unetvale 0 → R$0 fora da fila.
--
-- FORMA DE EXECUÇÃO: SQL Editor do Supabase (autocommit, statement a statement). Idempotente.
-- IMPORTANTE: após aplicar, rodar "Recalcular pendentes" em /pagamentos.

-- ============ Contagem ANTES ============
SELECT 'ANTES a reabrir' AS etapa, count(*) AS linhas
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
WHERE p.override_by IS NOT NULL
  AND p.override_motivo IN ('Improdutiva rejeitada em lote', 'Improdutiva rejeitada na fila de aprovação')
  AND lower(btrim(sv.sucesso)) NOT LIKE 'sim%'
  AND p.closing_id IS NULL
  AND p.paid_at IS NULL;

-- ============ Reabertura ============
UPDATE payouts p
SET valor_override = NULL,
    override_motivo = NULL,
    override_by = NULL,
    override_at = NULL,
    improdutiva_aprovada = NULL,
    status = 'pending'
FROM service_visits sv
WHERE sv.id = p.visit_id
  AND p.override_by IS NOT NULL
  AND p.override_motivo IN ('Improdutiva rejeitada em lote', 'Improdutiva rejeitada na fila de aprovação')
  AND lower(btrim(sv.sucesso)) NOT LIKE 'sim%'
  AND p.closing_id IS NULL
  AND p.paid_at IS NULL;

-- ============ Contagem DEPOIS (deve ser 0) ============
SELECT 'DEPOIS ainda com override de rejeição' AS etapa, count(*) AS linhas
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
WHERE p.override_by IS NOT NULL
  AND p.override_motivo IN ('Improdutiva rejeitada em lote', 'Improdutiva rejeitada na fila de aprovação')
  AND lower(btrim(sv.sucesso)) NOT LIKE 'sim%'
  AND p.closing_id IS NULL
  AND p.paid_at IS NULL;
