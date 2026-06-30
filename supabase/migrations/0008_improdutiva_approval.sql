-- Workflow de aprovação individual de visitas improdutivas (Sprint 8).
-- NULL = pendente de decisão do gestor, true = aprovada (gera payout), false = rejeitada (payout = 0).
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS improdutiva_aprovada BOOLEAN DEFAULT NULL;

-- Índice parcial para a fila de pendências: cobre apenas payouts vinculados a um
-- motivo (reason_id) e ainda sem decisão de aprovação.
CREATE INDEX IF NOT EXISTS idx_payouts_improdutiva_pendente
  ON payouts (tenant_id)
  WHERE improdutiva_aprovada IS NULL
    AND reason_id IS NOT NULL;
