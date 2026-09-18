-- =============================================================================
-- ⚠️⚠️⚠️  DESTRUTIVO E IRREVERSÍVEL  ⚠️⚠️⚠️
--
-- ESTE ARQUIVO APAGA TODO O HISTÓRICO DE SUPERVISÕES DE CAMPO E TODAS AS FOTOS.
-- NÃO HÁ COMO DESFAZER. Use SOMENTE para abandono definitivo do módulo.
--
-- ▸ PARA REVERTER UM INCIDENTE, NÃO USE ESTE ARQUIVO. Use a reversão de NÍVEL 1,
--   que é instantânea e não perde nenhum dado:
--
--       UPDATE tenants
--       SET config = jsonb_set(config, '{supervisao_campo_habilitada}', 'false'::jsonb, true)
--       WHERE slug = 'wave';
--
--   Com a flag desligada, o módulo some das duas UIs, as rotas dão 404 e as Server
--   Actions falham — mas as tabelas, as linhas e as fotos continuam lá, intactas.
--   Religar é trocar 'false' por 'true' na mesma query.
--
-- ▸ NÍVEL 1.5: reverter o deploy do código. As tabelas ficam órfãs e inertes; nada
--   em produção as lê. Também não perde dado.
--
-- ▸ NÍVEL 2 (este arquivo): só quando a decisão for remover o módulo do produto.
-- =============================================================================
--
-- Reversão de: supabase/migrations/0042_supervisao_campo.sql (ADR-022 · Sprint 19)
--
-- POR QUE ESTE ARQUIVO NÃO ESTÁ EM supabase/migrations/:
--   O CLI da Supabase varre aquele diretório. Um .down.sql ali é um acidente esperando
--   acontecer. Este diretório é inerte para qualquer runner — só roda se um humano
--   colar o conteúdo deliberadamente no SQL Editor.
--
-- O QUE ESTE ARQUIVO NÃO TOCA:
--   service_visits, service_orders, payouts, consolidar_service_order(), os triggers
--   de consolidação e auditoria, o auth hook, os 5 papéis, o bucket `uploads` e suas
--   3 policies. Nada nessas estruturas referencia as tabelas removidas aqui, então os
--   DROP abaixo não alcançam nada delas.
--
-- ANTES DE RODAR:
--   1. Snapshot do projeto Supabase.
--   2. Exportar as fotos do bucket, se houver qualquer chance de precisarem delas.
--   3. Conferir o que será perdido — o passo 0 abaixo mostra.
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Sem BEGIN/COMMIT.
-- Aplicar statement a statement, conferindo cada um.
-- =============================================================================


-- ── 0. O QUE SERÁ PERDIDO — rodar ANTES e ler o resultado ────────────────────────────────
-- Se estes números não forem aceitáveis, PARE AQUI e use a reversão de nível 1.
SELECT 'supervisoes'      AS o_que, count(*) AS linhas FROM field_supervisions
UNION ALL
SELECT 'concluidas',      count(*) FROM field_supervisions WHERE status = 'concluida'
UNION ALL
SELECT 'respostas',       count(*) FROM supervision_answers
UNION ALL
SELECT 'fotos',           count(*) FROM supervision_photos WHERE uploaded_em IS NOT NULL
UNION ALL
SELECT 'itens_checklist', count(*) FROM supervision_checklist_items;


-- ── 1. Desligar a flag primeiro ───────────────────────────────────────────────────────────
-- Fecha a porta antes de derrubar a casa: nenhuma Server Action consegue mais escrever
-- enquanto os DROP rodam.
UPDATE tenants
SET config = jsonb_set(config, '{supervisao_campo_habilitada}', 'false'::jsonb, true)
WHERE config ? 'supervisao_campo_habilitada';


-- ── 2. Esvaziar o bucket ──────────────────────────────────────────────────────────────────
-- O bucket precisa estar vazio para ser removido. Isto apaga os arquivos de verdade.
DELETE FROM storage.objects WHERE bucket_id = 'supervisao-fotos';


-- ── 3. Policies do bucket ─────────────────────────────────────────────────────────────────
-- Só as 'supervisao_fotos_*'. As 3 'uploads_tenant_*' NÃO são tocadas.
DROP POLICY IF EXISTS "supervisao_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "supervisao_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "supervisao_fotos_delete" ON storage.objects;


-- ── 4. Bucket ─────────────────────────────────────────────────────────────────────────────
DELETE FROM storage.buckets WHERE id = 'supervisao-fotos';


-- ── 5. Tabelas, em ordem inversa de dependência ───────────────────────────────────────────
-- CASCADE cobre os triggers set_updated_at, os índices e as FKs internas do módulo.
DROP TABLE IF EXISTS supervision_photos         CASCADE;
DROP TABLE IF EXISTS supervision_answers        CASCADE;
DROP TABLE IF EXISTS field_supervisions         CASCADE;
DROP TABLE IF EXISTS supervision_checklist_items CASCADE;


-- ── 6. Remover a chave de config ──────────────────────────────────────────────────────────
UPDATE tenants SET config = config - 'supervisao_campo_habilitada';


-- =============================================================================
-- CONFERÊNCIAS DA REVERSÃO
-- =============================================================================

-- ── 1. Nenhuma das 4 tabelas existe mais ──────────────────────────────────────────────────
-- Esperado: 0 linhas.
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('supervision_checklist_items', 'field_supervisions',
                    'supervision_answers', 'supervision_photos');

-- ── 2. Bucket e policies do módulo removidos; os do `uploads` INTACTOS ────────────────────
-- Esperado: nenhum 'supervisao-fotos'; as 3 'uploads_tenant_*' ainda presentes.
SELECT id FROM storage.buckets ORDER BY id;
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;

-- ── 3. A chave de config sumiu ────────────────────────────────────────────────────────────
-- Esperado: habilitada = null em todos.
SELECT slug, config -> 'supervisao_campo_habilitada' AS habilitada FROM tenants ORDER BY slug;

-- ── 4. REGRA DE OURO: o que já existia continua idêntico ──────────────────────────────────
-- Esperado: a MESMA contagem anotada antes de aplicar a 0042.
SELECT c.relname AS tabela, count(*) AS triggers
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('service_visits', 'payouts', 'service_orders')
GROUP BY c.relname ORDER BY c.relname;

-- ── 5. A função de consolidação continua lá, intocada ─────────────────────────────────────
-- Esperado: 1 linha.
SELECT proname FROM pg_proc WHERE proname = 'consolidar_service_order';
