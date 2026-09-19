-- =============================================================================
-- ⚠️ DESTRUTIVO — apaga respostas e configuração de checklist.
--
-- Reversão de: supabase/migrations/0044_checklist_epi_foto_obrigatoria.sql
--
-- ▸ NÍVEL 1 (sem tocar no banco): reverter o deploy do código. As colunas novas ficam
--   preenchidas mas ninguém as lê; o checklist volta a se comportar como antes da 0044.
--   Nenhum dado se perde. É esta a reversão de incidente.
--
-- ▸ NÍVEL 2 (este arquivo): só para desfazer a decisão de foto obrigatória e escalas.
--   Apaga as colunas — e com elas a marcação de quais itens exigiam foto e qual escala cada
--   um usava. Respostas gravadas como 'necessita_troca' passam a violar o CHECK antigo, por
--   isso o passo 1 as converte em 'nao_conforme': é a leitura mais próxima (as duas contam
--   como falha na nota), mas a distinção se perde para sempre.
--
-- Sem bloco DO $$. Sem BEGIN/COMMIT. Aplicar statement a statement.
-- =============================================================================


-- ── 0. O QUE SERÁ PERDIDO — rodar ANTES ───────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM supervision_answers WHERE resposta = 'necessita_troca')
    AS respostas_necessita_troca_que_viram_nao_conforme,
  (SELECT count(*) FROM supervision_checklist_items WHERE foto_obrigatoria)
    AS itens_que_exigem_foto,
  (SELECT count(*) FROM supervision_checklist_items WHERE tipo_resposta <> 'conformidade')
    AS itens_com_escala_propria,
  (SELECT count(*) FROM field_supervisions WHERE nota_qualidade_tecnica IS NOT NULL)
    AS supervisoes_com_nota_de_qualidade;


-- ── 1. Converter o estado que o CHECK antigo não aceita ───────────────────────────────────
-- Sem isto o ADD CONSTRAINT do passo 3 falha e a tabela fica sem constraint.
UPDATE supervision_answers SET resposta = 'nao_conforme' WHERE resposta = 'necessita_troca';


-- ── 2. Remover as colunas da 0044 ─────────────────────────────────────────────────────────
ALTER TABLE supervision_checklist_items DROP CONSTRAINT IF EXISTS chk_sup_item_tipo_resposta;
ALTER TABLE supervision_checklist_items DROP COLUMN IF EXISTS foto_obrigatoria;
ALTER TABLE supervision_checklist_items DROP COLUMN IF EXISTS tipo_resposta;

DROP INDEX IF EXISTS idx_sup_answers_exigem_foto;
ALTER TABLE supervision_answers DROP CONSTRAINT IF EXISTS chk_sup_answer_tipo_resposta;
ALTER TABLE supervision_answers DROP COLUMN IF EXISTS item_foto_obrigatoria;
ALTER TABLE supervision_answers DROP COLUMN IF EXISTS item_tipo_resposta;

ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_qualidade;
ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_empresa;
ALTER TABLE field_supervisions DROP COLUMN IF EXISTS nota_qualidade_tecnica;
ALTER TABLE field_supervisions DROP COLUMN IF EXISTS empresa;
ALTER TABLE field_supervisions DROP COLUMN IF EXISTS cluster;


-- ── 3. Restaurar o CHECK de resposta da 0042 ──────────────────────────────────────────────
ALTER TABLE supervision_answers DROP CONSTRAINT IF EXISTS chk_sup_answer_resposta;
ALTER TABLE supervision_answers ADD CONSTRAINT chk_sup_answer_resposta
  CHECK (resposta IS NULL OR resposta IN ('conforme', 'nao_conforme', 'nao_se_aplica'));


-- ── 4. (OPCIONAL) Remover os 48 itens semeados ────────────────────────────────────────────
-- Só rode se quiser mesmo a lista vazia. Itens já usados em supervisões perdem o rastro:
-- a cópia congelada nas respostas sobrevive, mas `item_id` fica nulo.
-- DELETE FROM supervision_checklist_items WHERE codigo LIKE 'POSSE-%' OR codigo LIKE 'USO-%';


-- ── CONFERÊNCIA ───────────────────────────────────────────────────────────────────────────
-- Esperado: 0 linhas (nenhuma coluna da 0044 sobrou).
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name IN ('foto_obrigatoria', 'tipo_resposta', 'item_foto_obrigatoria',
                      'item_tipo_resposta', 'nota_qualidade_tecnica', 'empresa', 'cluster')
  AND table_name IN ('supervision_checklist_items', 'supervision_answers', 'field_supervisions');
