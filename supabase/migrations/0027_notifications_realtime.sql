-- =============================================================================
-- 0027 — Realtime na tabela notifications (sineta ao vivo)
--
-- Habilita o Supabase Realtime para `notifications`, para a sineta atualizar em
-- tempo real (sem refresh). O client de browser é autenticado (anon key + cookies),
-- então o Realtime respeita a RLS `notif_own` (cada usuário só recebe as suas).
--
-- Aplicar via Supabase SQL Editor. Idempotente.
-- =============================================================================

-- 1. Adiciona a tabela à publicação de realtime (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Controle: a tabela deve estar na publicação (esperado: 1)
SELECT 'notifications na supabase_realtime' AS etapa, count(*) AS total
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename = 'notifications';
