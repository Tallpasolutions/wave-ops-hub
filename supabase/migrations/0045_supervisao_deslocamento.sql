-- =============================================================================
-- 0045 — Supervisão: estado de deslocamento e carimbos de hora (ADR-022 · Sprint 19)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Sem BEGIN/COMMIT. Idempotente.
-- Aplicar colando no SQL Editor do Supabase.
--
-- ── PROBLEMA ──────────────────────────────────────────────────────────────────────────────
-- A máquina de estados da 0042 ia de `agendada` direto para `em_execucao`. Na prática o
-- gestor precisa acompanhar a agenda do dia sem ligar para ninguém, e "o supervisor já saiu?"
-- é uma pergunta diferente de "já está vistoriando?".
--
-- ── DECISÃO (Jhoni Cleyton, 2026-09-19) ───────────────────────────────────────────────────
-- O supervisor registra TRÊS momentos pelo celular — saiu, começou, terminou — e cada um
-- carimba a hora. A agenda do gestor mostra o símbolo do estado por slot.
--
--   agendada → em_deslocamento → em_execucao → concluida
--
-- O deslocamento é REGISTRÁVEL, NÃO OBRIGATÓRIO: quem já está no local, ou esqueceu de marcar
-- a saída, precisa conseguir começar a vistoria mesmo assim. `agendada → em_execucao` segue
-- válida, e ter ido direto é em si informação para o gestor.
--
-- ── O QUE ESTE ARQUIVO FAZ ────────────────────────────────────────────────────────────────
-- Amplia o CHECK de status da 0042 (aceita 'em_deslocamento') e acrescenta duas colunas de
-- carimbo, ambas nullable — nenhuma linha existente é afetada.
--
-- ⚠️ Ampliar CHECK é DROP + ADD. A Conferência 0 confirma que nada viola o predicado novo
--    antes de aplicar; como ele só ACRESCENTA um valor aceito, nada existente pode violá-lo.
--
-- Não toca service_visits, service_orders, payouts, o auth hook, os papéis nem a RLS.
--
-- ── REVERSÃO ──────────────────────────────────────────────────────────────────────────────
-- supabase/rollback/0045_supervisao_deslocamento.down.sql
-- Só é possível enquanto nenhuma supervisão estiver em 'em_deslocamento'.
-- =============================================================================


-- ── CONFERÊNCIA 0 — rodar ANTES ───────────────────────────────────────────────────────────
-- Esperado: 0 linhas. O CHECK novo só amplia, então nada existente deve violar.
SELECT id, status FROM field_supervisions
WHERE status NOT IN ('agendada', 'em_deslocamento', 'em_execucao', 'concluida', 'cancelada');


-- ── 1. Estado novo no CHECK ───────────────────────────────────────────────────────────────
ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_status;
ALTER TABLE field_supervisions ADD CONSTRAINT chk_field_sup_status
  CHECK (status IN ('agendada', 'em_deslocamento', 'em_execucao', 'concluida', 'cancelada'));


-- ── 2. Carimbos de hora ───────────────────────────────────────────────────────────────────
-- Quando o supervisor saiu para o local. Nulo quando ele pulou o deslocamento.
ALTER TABLE field_supervisions
  ADD COLUMN IF NOT EXISTS deslocamento_iniciado_em TIMESTAMPTZ;

-- Quando chegou. Separado de `iniciada_em` de propósito: chegar e começar a vistoria são
-- coisas diferentes, e a diferença entre os dois é o tempo de preparação no local.
ALTER TABLE field_supervisions
  ADD COLUMN IF NOT EXISTS chegada_em TIMESTAMPTZ;


-- ── 3. Índice da agenda do dia ────────────────────────────────────────────────────────────
-- A consulta quente do gestor passa a ser "o que está acontecendo agora, neste tenant".
-- Parcial porque em andamento é sempre minoria das linhas.
CREATE INDEX IF NOT EXISTS idx_field_sup_em_andamento
  ON field_supervisions(tenant_id, data_agendada)
  WHERE status IN ('em_deslocamento', 'em_execucao');


-- =============================================================================
-- CONFERÊNCIAS — rodar depois de aplicar
-- =============================================================================

-- ── 1. O CHECK aceita os CINCO estados ────────────────────────────────────────────────────
-- Esperado: a definição contém 'em_deslocamento'.
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'field_supervisions'::regclass AND conname = 'chk_field_sup_status';

-- ── 2. Colunas de carimbo existem e são nullable ──────────────────────────────────────────
-- Esperado: 2 linhas, ambas is_nullable = 'YES'.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'field_supervisions'
  AND column_name IN ('deslocamento_iniciado_em', 'chegada_em')
ORDER BY column_name;

-- ── 3. Os CHECKs de conclusão e cancelamento seguem intactos ──────────────────────────────
-- Esperado: chk_field_sup_concluida_completa e chk_field_sup_cancelada_completa presentes.
SELECT conname FROM pg_constraint
WHERE conrelid = 'field_supervisions'::regclass AND contype = 'c'
ORDER BY conname;

-- ── 4. REGRA DE OURO: nada existente mudou ────────────────────────────────────────────────
-- Esperado: payouts 3, service_orders 1, service_visits 3.
SELECT c.relname AS tabela, count(*) AS triggers
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('service_visits', 'payouts', 'service_orders')
GROUP BY c.relname ORDER BY c.relname;
