-- =============================================================================
-- 0023 — LPU por técnico (ADR-014)
--
-- Permite atribuir uma LPU específica a um técnico (ex.: tabela "SEM AUXILIAR").
-- Vazio = usa a LPU padrão ativa do tenant. O motor de payout resolve, por visita,
-- a LPU do técnico se houver; senão a padrão.
--
-- Aplicar via Supabase SQL Editor. Idempotente.
-- =============================================================================

ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS lpu_id UUID REFERENCES lpus(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_technicians_lpu
  ON technicians(lpu_id) WHERE lpu_id IS NOT NULL;
