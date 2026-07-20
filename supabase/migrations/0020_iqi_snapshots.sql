-- =============================================================================
-- 0020 — Snapshots mensais do Indicador IQI (ADR-012)
--
-- O IQI (índice de reincidência da Unetvale) é coletado por scraping autenticado
-- do endpoint /index/iqi e persistido aqui, um registro por (tenant, técnico,
-- competência). Fonte e fluxo em docs/architecture/ADR-012-iqi-ingestao-scraping.md.
--
-- Aplicar manualmente via Supabase SQL Editor antes do deploy. Idempotente:
-- CREATE ... IF NOT EXISTS e os GRANTs/policies são reexecutáveis com segurança.
-- =============================================================================

-- 1. Tabela de snapshots (um por técnico/competência)
CREATE TABLE IF NOT EXISTS iqi_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tecnico_id             UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  competencia            TEXT NOT NULL,                 -- "AAAA-MM"
  total_os               INTEGER NOT NULL,
  contratos_reincidentes INTEGER NOT NULL,
  pct_reincidencia       NUMERIC(5,2) NOT NULL,         -- 0.00–100.00 (o IQI)
  os_nums                JSONB,                         -- {"total":[...],"reincidentes":[...]} p/ drilldown
  tipos_servico          TEXT NOT NULL,                 -- filtro usado na coleta
  synced_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, tecnico_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_iqi_tenant_competencia
  ON iqi_snapshots(tenant_id, competencia);
CREATE INDEX IF NOT EXISTS idx_iqi_tenant_tecnico
  ON iqi_snapshots(tenant_id, tecnico_id);

-- 2. updated_at automático (função set_updated_at() já existe desde 0001)
DROP TRIGGER IF EXISTS set_updated_at ON iqi_snapshots;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON iqi_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RLS: isolamento por tenant; técnico lê só o próprio; supervisor lê a equipe.
--    Espelha a policy de service_visits (migration 0009). Escrita é via service_role
--    (coletor), então gestor/técnico só precisam de leitura coerente.
ALTER TABLE iqi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON iqi_snapshots;
CREATE POLICY tenant_isolation ON iqi_snapshots FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_technician' AND tecnico_id = current_technician_id())
        OR (
          current_user_role() = 'tenant_supervisor'
          AND (
            tecnico_id = current_technician_id()
            OR tecnico_id IN (
              SELECT st.technician_id
              FROM supervisor_technicians st
              WHERE st.supervisor_id = auth.uid()
                AND st.tenant_id = current_tenant_id()
            )
          )
        )
      )
    )
  );

-- 4. GRANTs (mesmo padrão de 0009/0015)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE iqi_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE iqi_snapshots TO service_role;
