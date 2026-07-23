-- =============================================================================
-- 0029 — Valor antes/depois na resolução de contestação (ADR-013)
--
-- Ao resolver uma contestação, a Wave pode ajustar o valor do payout daquela OS.
-- Guardamos o valor efetivo ANTES (valor_anterior) e DEPOIS (valor_novo) para o
-- técnico ver a pontuação que era → a atual. NULL = contestação anterior a esta feature.
--
-- Aplicar via Supabase SQL Editor. Idempotente.
-- =============================================================================

ALTER TABLE payout_contestacoes
  ADD COLUMN IF NOT EXISTS valor_anterior NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS valor_novo NUMERIC(10, 2);
