-- =============================================================================
-- 0009 — Role Supervisor
--
-- 1. Adiciona 'tenant_supervisor' ao CHECK de users.role
-- 2. Atualiza CHECKs de consistência (supervisor tem tenant_id e technician_id)
-- 3. Cria tabela supervisor_technicians (relação N:N supervisor ↔ técnico)
-- 4. Atualiza RLS de service_visits e payouts para incluir supervisores
--
-- Aplicar manualmente via Supabase SQL Editor antes do deploy.
-- Nomes dos constraints auto-gerados pelo Postgres a partir de 0001_initial_schema.sql:
--   users_role_check           → inline CHECK na coluna role
--   users_check                → primeiro CHECK de tabela (tenant_role_consistency)
--   users_check1               → segundo CHECK de tabela  (technician_role_consistency)
-- =============================================================================

-- 1. Atualizar CHECK de role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('tallpa_owner', 'tenant_owner', 'tenant_manager', 'tenant_technician', 'tenant_supervisor'));

-- 2. Atualizar CHECK de consistência tenant (supervisor tem tenant_id)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE users ADD CONSTRAINT users_check
  CHECK (
    (role = 'tallpa_owner' AND tenant_id IS NULL)
    OR (role IN ('tenant_owner', 'tenant_manager', 'tenant_technician', 'tenant_supervisor') AND tenant_id IS NOT NULL)
  );

-- 3. Atualizar CHECK de consistência technician (supervisor também tem technician_id)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check1;
ALTER TABLE users ADD CONSTRAINT users_check1
  CHECK (
    (role IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NOT NULL)
    OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)
  );

-- 4. Tabela de associação supervisor ↔ técnico supervisionado
CREATE TABLE IF NOT EXISTS supervisor_technicians (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, technician_id)
);

CREATE INDEX idx_supervisor_technicians_supervisor ON supervisor_technicians(supervisor_id);
CREATE INDEX idx_supervisor_technicians_technician ON supervisor_technicians(technician_id);

ALTER TABLE supervisor_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON supervisor_technicians FOR ALL
  USING (
    is_tallpa_owner()
    OR tenant_id = current_tenant_id()
  );

-- 5. Atualizar RLS de service_visits para incluir supervisor
DROP POLICY IF EXISTS tenant_isolation ON service_visits;
CREATE POLICY tenant_isolation ON service_visits FOR ALL
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

-- 6. Atualizar RLS de payouts para incluir supervisor
DROP POLICY IF EXISTS tenant_isolation ON payouts;
CREATE POLICY tenant_isolation ON payouts FOR ALL
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
