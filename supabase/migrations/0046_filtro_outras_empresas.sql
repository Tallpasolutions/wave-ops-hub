-- =============================================================================
-- 0046 — Lista de empresas do tenant e registro do que o upload descartou (ADR-024)
--
-- APLICAR ANTES DO DEPLOY: o ingestor grava e a tela de upload lê `uploads.outras_empresas`.
-- Sem a coluna, o upload fica preso em "processando" e a tela do upload dá 404.
-- Idempotente. Não apaga nada: a remoção do que já entrou é a 0047.
-- =============================================================================

ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS outras_empresas JSONB;

UPDATE tenants
SET config = jsonb_set(config, '{prefixos_empresa}', '["WAVE","INFRA WAVE","WAVE SUPERVISOR"]'::jsonb, true)
WHERE slug = 'wave';

SELECT slug, config -> 'prefixos_empresa' AS prefixos_empresa
FROM tenants
WHERE slug = 'wave';
