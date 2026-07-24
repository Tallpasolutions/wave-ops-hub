-- =============================================================================
-- 0030 — Registrar o acréscimo de domingo/feriado no payout (ADR-011)
--
-- Até aqui o payout guardava só `valor_calculado` (com o +15% já embutido), sem
-- marca de que o acréscimo foi aplicado. A tela do pagamento (gestor) e a
-- conferência do técnico precisam mostrar "base → +pct% → total", então passamos
-- a persistir o VALOR em R$ que o acréscimo somou — capturado no cálculo
-- (buildPayoutUpsert), não deduzido na leitura. NULL = não incidiu.
--
-- Não recalcula nada por si. Os payouts existentes ficam com NULL até o próximo
-- recálculo (upload ou "Recalcular pendentes"), que preenche a coluna.
--
-- Aplicar via Supabase SQL Editor. Idempotente.
-- =============================================================================

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS acrescimo_dom_feriado NUMERIC(10, 2);

-- Controle: coluna criada (esperado: 1)
SELECT 'acrescimo_dom_feriado' AS coluna, count(*) AS existe
FROM information_schema.columns
WHERE table_name = 'payouts' AND column_name = 'acrescimo_dom_feriado';
