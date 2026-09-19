-- =============================================================================
-- Reversão de: supabase/migrations/0045_supervisao_deslocamento.sql
--
-- ▸ NÍVEL 1 (sem tocar no banco): reverter o deploy. Os botões somem do app e as colunas
--   ficam preenchidas sem ninguém ler. Nenhum dado se perde.
--
-- ▸ NÍVEL 2 (este arquivo): perde os carimbos de deslocamento e chegada.
--   Só funciona se NENHUMA supervisão estiver em 'em_deslocamento' — reapertar o CHECK com
--   linhas nesse estado deixaria a tabela sem constraint.
--
-- Sem bloco DO $$. Sem BEGIN/COMMIT.
-- =============================================================================

-- ── 0. DÁ PARA REVERTER? — rodar ANTES ────────────────────────────────────────────────────
-- Esperado: 0 em deslocamento. Se houver, decida o estado dessas supervisões antes.
SELECT
  count(*) FILTER (WHERE status = 'em_deslocamento')          AS em_deslocamento,
  count(*) FILTER (WHERE deslocamento_iniciado_em IS NOT NULL) AS carimbos_de_saida_perdidos,
  count(*) FILTER (WHERE chegada_em IS NOT NULL)               AS carimbos_de_chegada_perdidos
FROM field_supervisions;

-- ── 1. Reapertar o CHECK para os 4 estados da 0042 ────────────────────────────────────────
ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_status;
ALTER TABLE field_supervisions ADD CONSTRAINT chk_field_sup_status
  CHECK (status IN ('agendada', 'em_execucao', 'concluida', 'cancelada'));

-- ── 2. Remover carimbos e índice ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_field_sup_em_andamento;
ALTER TABLE field_supervisions DROP COLUMN IF EXISTS deslocamento_iniciado_em;
ALTER TABLE field_supervisions DROP COLUMN IF EXISTS chegada_em;

-- ── CONFERÊNCIA ───────────────────────────────────────────────────────────────────────────
-- Esperado: a definição do CHECK volta a NÃO conter 'em_deslocamento'.
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'field_supervisions'::regclass AND conname = 'chk_field_sup_status';
