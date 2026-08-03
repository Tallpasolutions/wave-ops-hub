-- =============================================================================
-- 0041 — Registro de alterações de valor da Unetvale por OS de garantia (ADR-021)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Idempotente. Não altera nenhuma tabela
-- existente além de criar um índice em service_visits_audit.
--
-- ── PROBLEMA ──────────────────────────────────────────────────────────────────────────────
-- A Unetvale altera o valor de uma OS depois de já ter informado outro. Quando isso acontece
-- por abertura de OS de garantia, ela reduz a receita da Wave em R$ 60,50 e ninguém fica
-- sabendo: a planilha nova sobrescreve a antiga em silêncio.
--
-- Levantamento em 03/08/2026 sobre `service_visits_audit` (que já registra todo UPDATE de visita
-- desde o início, 3.554 linhas): 4 ocorrências, R$ 242,00 de receita perdida, nenhuma revisada.
--
--   OS 572737 · 20/07 · R$  64,46 → R$   3,96
--   OS 571722 · 21/07 · R$ 206,26 → R$ 145,76
--   OS 573851 · 21/07 · R$ 232,04 → R$ 171,54
--   OS 574908 · 23/07 · R$ 232,04 → R$ 171,54
--
-- Todas com a observação "DD/MM/AAAA HH:MM - Pagamento alterado devido a abertura da OS de
-- garantia" e redução de exatamente R$ 60,50.
--
-- ⚠️ O campo `garantia` da planilha NÃO serve para detectar isso: das 2.345 visitas, todas têm
-- `garantia = false` e nenhuma tem `true` — a Unetvale nunca preenche a coluna. O sinal é a
-- observação (mais a assinatura de −R$ 60,50 como trava contra mudança de redação).
-- =============================================================================

-- ── 1. Tabela ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unetvale_alteracoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visit_id            UUID NOT NULL REFERENCES service_visits(id) ON DELETE CASCADE,
  os_num              INTEGER NOT NULL,
  -- desnormalizado de propósito: é por ele que a RLS do técnico filtra, sem join.
  technician_id       UUID REFERENCES technicians(id) ON DELETE SET NULL,
  upload_id           UUID REFERENCES uploads(id) ON DELETE SET NULL,
  observacao_unetvale TEXT,
  receita_anterior    NUMERIC(10,2),
  receita_nova        NUMERIC(10,2),
  -- payout ANTES do recálculo (snapshot na detecção) e DEPOIS. Só notifica o técnico quando
  -- os dois diferem — receita da Unetvale ele não vê, pontos sim.
  payout_anterior     NUMERIC(10,2),
  payout_novo         NUMERIC(10,2),
  ciente_por          UUID REFERENCES users(id),
  ciente_em           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detecção idempotente: reprocessar o mesmo upload não duplica registro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_unetvale_alt_visita_upload
  ON unetvale_alteracoes(visit_id, upload_id, receita_anterior, receita_nova);

-- A fila do gestor.
CREATE INDEX IF NOT EXISTS idx_unetvale_alt_pendentes
  ON unetvale_alteracoes(tenant_id, ciente_em) WHERE ciente_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_unetvale_alt_visita ON unetvale_alteracoes(visit_id);
CREATE INDEX IF NOT EXISTS idx_unetvale_alt_tecnico ON unetvale_alteracoes(technician_id);

DROP TRIGGER IF EXISTS set_updated_at ON unetvale_alteracoes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON unetvale_alteracoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A detecção filtra a auditoria pelo upload que causou a mudança; sem índice isso é seq scan.
CREATE INDEX IF NOT EXISTS idx_visits_audit_upload ON service_visits_audit(upload_id);

-- ── 2. RLS — mesmo padrão de payout_contestacoes (0022) ───────────────────────────────────
ALTER TABLE unetvale_alteracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON unetvale_alteracoes;
CREATE POLICY tenant_isolation ON unetvale_alteracoes FOR ALL
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE unetvale_alteracoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE unetvale_alteracoes TO service_role;

-- ── 3. Backfill dos 4 casos históricos ────────────────────────────────────────────────────
-- Mesmo predicado da detecção em código (src/lib/etl/alteracoes.ts): texto da observação OU
-- redução de exatamente R$ 60,50. Entram como PENDENTES de ciência — são R$ 242,00 que a Wave
-- perdeu e nunca revisou. `payout_anterior` = o payout de hoje (não houve recálculo entre a
-- alteração e agora que mudasse esses casos), `payout_novo` fica nulo por ser retroativo.
INSERT INTO unetvale_alteracoes
  (tenant_id, visit_id, os_num, technician_id, upload_id, observacao_unetvale,
   receita_anterior, receita_nova, payout_anterior)
SELECT sv.tenant_id, sv.id, sv.os_num, sv.tecnico_id, a.upload_id,
       a.after ->> 'observacoes',
       (a.before ->> 'valor_recebido_unetvale')::numeric,
       (a.after  ->> 'valor_recebido_unetvale')::numeric,
       p.valor_calculado
FROM service_visits_audit a
JOIN service_visits sv ON sv.id = a.visit_id
LEFT JOIN payouts p ON p.visit_id = sv.id
WHERE (a.before ->> 'valor_recebido_unetvale')::numeric
      IS DISTINCT FROM (a.after ->> 'valor_recebido_unetvale')::numeric
  AND (
        lower(coalesce(a.after ->> 'observacoes', '')) LIKE '%abertura da os de garantia%'
        OR round(
             (a.after ->> 'valor_recebido_unetvale')::numeric
             - (a.before ->> 'valor_recebido_unetvale')::numeric, 2) = -60.50
      )
ON CONFLICT (visit_id, upload_id, receita_anterior, receita_nova) DO NOTHING;

-- ── Conferência 1: exatamente 4 linhas, todas com −R$ 60,50 ───────────────────────────────
-- Se aparecer alguma OS de "outro técnico fechou" ou "improdutiva invalidada", o predicado
-- está frouxo — investigar antes de seguir.
SELECT os_num, receita_anterior, receita_nova,
       round(receita_nova - receita_anterior, 2) AS variacao,
       payout_anterior, ciente_em,
       left(coalesce(observacao_unetvale, ''), 60) AS observacao
FROM unetvale_alteracoes
ORDER BY os_num;

-- ── Conferência 2: nada além de garantia entrou ───────────────────────────────────────────
-- Esperado: 4 e 4. Qualquer diferença significa registro indevido.
SELECT count(*) AS total,
       count(*) FILTER (WHERE round(receita_nova - receita_anterior, 2) = -60.50) AS com_assinatura_garantia
FROM unetvale_alteracoes;
