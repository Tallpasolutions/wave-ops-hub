-- =============================================================================
-- 0025 — Repasse de Homologação por valor da Unetvale (ADR-015)
--
-- Homologação é identificada pela coluna Z (explicacao_valor começa com
-- "Homologa..."), NÃO pela finalidade — a mesma finalidade "Instalação - Fibra"
-- pode ser uma instalação real (regra de LPU) ou uma homologação (repasse fixo).
--
-- O repasse ao técnico varia com o valor que a Unetvale pagou, e o caso "dobrado"
-- (2x a base) tem a MESMA explicação da base — só o valor da Unetvale distingue.
-- Por isso a classificação é indexada por `valor_unetvale`, não pelo texto.
--
-- O gestor mantém o mapa (valor Unetvale -> repasse). Homologação com valor não
-- cadastrado cai em `no_rule_match` e aparece na fila para o gestor classificar —
-- nunca paga o valor errado de instalação em silêncio.
--
-- Aplicar manualmente via Supabase SQL Editor antes do deploy. Idempotente:
-- CREATE ... IF NOT EXISTS, jsonb_set, ON CONFLICT e os GRANTs são reexecutáveis.
-- Ver docs/architecture/ADR-015-homologacao-repasse.md
-- =============================================================================

-- 1. Tabela de classificação (espelha cabeamento_classifications de 0015)
CREATE TABLE IF NOT EXISTS homologacao_classifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  valor_unetvale NUMERIC(10,2) NOT NULL,
  valor_repasse  NUMERIC(10,2) NOT NULL,
  observacao     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, valor_unetvale)
);

CREATE INDEX IF NOT EXISTS idx_homologacao_class_tenant
  ON homologacao_classifications(tenant_id);

-- 2. updated_at automático (função set_updated_at() já existe desde 0001)
DROP TRIGGER IF EXISTS set_updated_at ON homologacao_classifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON homologacao_classifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RLS por tenant (mesmo padrão das demais tabelas)
ALTER TABLE homologacao_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON homologacao_classifications;
CREATE POLICY tenant_isolation ON homologacao_classifications FOR ALL
  USING (
    is_tallpa_owner()
    OR tenant_id = current_tenant_id()
  );

-- 4. GRANTs (mesmo padrão de 0015)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE homologacao_classifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE homologacao_classifications TO service_role;

-- 5. Flag do tenant que liga o tratamento de homologação por explicação (padrão de 0013/0015)
UPDATE tenants
SET config = jsonb_set(config, '{homologacao_por_explicacao}', 'true'::jsonb, true)
WHERE slug = 'wave';

-- 6. Seed dos valores conhecidos da Unetvale (reajuste +6,54% fevereiro/2025)
--    base 64,46 -> 35 ; dobrado 128,92 -> 70 ; +1 ponto adicional 142,23 -> 79
INSERT INTO homologacao_classifications (tenant_id, valor_unetvale, valor_repasse, observacao)
SELECT t.id, v.valor_unetvale, v.valor_repasse, v.observacao
FROM tenants t
CROSS JOIN (VALUES
  (64.46::numeric,  35.00::numeric, 'Homologação base'),
  (128.92::numeric, 70.00::numeric, 'Homologação dobrada (2x base)'),
  (142.23::numeric, 79.00::numeric, 'Homologação + 1 ponto adicional (35 + 44)')
) AS v(valor_unetvale, valor_repasse, observacao)
WHERE t.slug = 'wave'
ON CONFLICT (tenant_id, valor_unetvale) DO NOTHING;

-- Controle: valores cadastrados para o tenant Wave (esperado: 3)
SELECT 'homologacao_classifications' AS etapa, count(*) AS total
FROM homologacao_classifications hc
JOIN tenants t ON t.id = hc.tenant_id
WHERE t.slug = 'wave';
