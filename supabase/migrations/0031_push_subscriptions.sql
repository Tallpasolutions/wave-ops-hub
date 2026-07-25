-- =============================================================================
-- 0031 — Inscrições de Web Push (notificação com app fechado) — ADR-018
--
-- Guarda a PushSubscription de cada navegador/dispositivo do usuário. O envio
-- (server-only, service role) lê daqui e dispara o push via VAPID; o técnico só
-- enxerga/gerencia as próprias inscrições (RLS espelhando notif_own).
--
-- tenant_id é NULLABLE de propósito: o tallpa_owner não tem tenant, mas também
-- pode assinar push (diferente de notifications, que exige tenant_id NOT NULL).
--
-- Aplicar via Supabase SQL Editor. Idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia as suas; tallpa_owner enxerga todas (igual notif_own).
-- O envio server-side usa service role e ignora esta policy.
DROP POLICY IF EXISTS push_own ON push_subscriptions;
CREATE POLICY push_own ON push_subscriptions FOR ALL
  USING (user_id = auth.uid() OR is_tallpa_owner())
  WITH CHECK (user_id = auth.uid() OR is_tallpa_owner());

-- Controle: a tabela deve existir com RLS habilitada (esperado: rowsecurity = true)
SELECT 'push_subscriptions' AS tabela, relrowsecurity AS rls
FROM pg_class
WHERE relname = 'push_subscriptions';
