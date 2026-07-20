-- =============================================================================
-- 0022 — Aprovação/contestação de payouts pelo técnico (Sprint 18)
--
-- Fluxo: Wave "Solicitar aprovação" → técnicos conferem suas OSs no app →
-- aprovam ou contestam (com motivo). Contestação volta para a Wave por técnico.
-- Após aprovação do técnico, a Wave aprova o pagamento e gera os PDFs.
--
-- Duas tabelas:
--  - closing_technician_reviews: estado da revisão por (tenant, periodo, técnico).
--  - payout_contestacoes: contestações individuais de payout, com motivo.
--
-- Aplicar via Supabase SQL Editor. Idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

-- 1. Revisão por técnico de um período -----------------------------------------
CREATE TABLE IF NOT EXISTS closing_technician_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodo       TEXT NOT NULL,                    -- 'AAAA-MM'
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'aprovado', 'contestado')),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, periodo, technician_id),
  CHECK (periodo ~ '^\d{4}-\d{2}$')
);

CREATE INDEX IF NOT EXISTS idx_ctr_tenant_periodo
  ON closing_technician_reviews(tenant_id, periodo);

DROP TRIGGER IF EXISTS set_updated_at ON closing_technician_reviews;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON closing_technician_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Contestações de payout ----------------------------------------------------
CREATE TABLE IF NOT EXISTS payout_contestacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payout_id       UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  technician_id   UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  periodo         TEXT NOT NULL,                  -- 'AAAA-MM'
  motivo          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta', 'resolvida')),
  resposta_gestor TEXT,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (periodo ~ '^\d{4}-\d{2}$')
);

CREATE INDEX IF NOT EXISTS idx_contestacoes_tenant_periodo
  ON payout_contestacoes(tenant_id, periodo);
CREATE INDEX IF NOT EXISTS idx_contestacoes_payout
  ON payout_contestacoes(payout_id);
-- Só uma contestação aberta por payout.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contestacao_aberta_por_payout
  ON payout_contestacoes(payout_id) WHERE status = 'aberta';

DROP TRIGGER IF EXISTS set_updated_at ON payout_contestacoes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON payout_contestacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RLS — mesmo padrão de service_visits (tenant; técnico vê/mexe no próprio;
--    supervisor vê a equipe; gestor/owner tudo do tenant). -----------------------
ALTER TABLE closing_technician_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON closing_technician_reviews;
CREATE POLICY tenant_isolation ON closing_technician_reviews FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_technician' AND technician_id = current_technician_id())
        OR (
          current_user_role() = 'tenant_supervisor'
          AND (
            technician_id = current_technician_id()
            OR technician_id IN (
              SELECT st.technician_id FROM supervisor_technicians st
              WHERE st.supervisor_id = auth.uid() AND st.tenant_id = current_tenant_id()
            )
          )
        )
      )
    )
  );

ALTER TABLE payout_contestacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON payout_contestacoes;
CREATE POLICY tenant_isolation ON payout_contestacoes FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_technician' AND technician_id = current_technician_id())
        OR (
          current_user_role() = 'tenant_supervisor'
          AND (
            technician_id = current_technician_id()
            OR technician_id IN (
              SELECT st.technician_id FROM supervisor_technicians st
              WHERE st.supervisor_id = auth.uid() AND st.tenant_id = current_tenant_id()
            )
          )
        )
      )
    )
  );

-- 4. GRANTs --------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE closing_technician_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE closing_technician_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payout_contestacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payout_contestacoes TO service_role;
