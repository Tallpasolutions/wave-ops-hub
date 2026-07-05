-- =============================================================================
-- 0015 — Classificação de payout de Cabeamento/Condomínio (ADR-009)
--
-- Finalidades cujo payout depende do serviço descrito na coluna Z
-- (explicacao_valor), não da finalidade. O gestor classifica cada padrão
-- distinto uma vez; o cálculo de payout reusa o valor. Ver docs/architecture/ADR-009.
--
-- Aplicar manualmente via Supabase SQL Editor antes do deploy. Idempotente:
-- CREATE ... IF NOT EXISTS, jsonb_set e os GRANTs são reexecutáveis com segurança.
-- =============================================================================

-- 1. Tabela de classificação (espelha reasons; padrão de tabela nova de 0009)
CREATE TABLE IF NOT EXISTS cabeamento_classifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  explicacao_original TEXT NOT NULL,
  explicacao_key      TEXT NOT NULL,
  valor               NUMERIC(10,2) NOT NULL,
  observacao          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, explicacao_key)
);

CREATE INDEX IF NOT EXISTS idx_cabeamento_class_tenant
  ON cabeamento_classifications(tenant_id);

-- 2. updated_at automático (função set_updated_at() já existe desde 0001)
DROP TRIGGER IF EXISTS set_updated_at ON cabeamento_classifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON cabeamento_classifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE cabeamento_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON cabeamento_classifications;
CREATE POLICY tenant_isolation ON cabeamento_classifications FOR ALL
  USING (
    is_tallpa_owner()
    OR tenant_id = current_tenant_id()
  );

-- 4. GRANTs (mesmo padrão de 0005/0007/0009)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cabeamento_classifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cabeamento_classifications TO service_role;

-- 5. Finalidades que classificam por explicação (config do tenant, padrão de 0013)
UPDATE tenants
SET config = jsonb_set(
  config,
  '{finalidades_classificar_explicacao}',
  '["Cabeamento/Segundo Ponto","Cabeamento Fibra","Instalação Condomínio","Retirada Condomínio"]'::jsonb,
  true
)
WHERE slug = 'wave';

-- Controle: finalidades no grupo (esperado: 4) e visitas atingidas (referência R2.4)
SELECT 'finalidades_classificar_explicacao' AS etapa,
       jsonb_array_length(config -> 'finalidades_classificar_explicacao') AS total
FROM tenants WHERE slug = 'wave';
