-- =============================================================================
-- 0016 — Acréscimo de domingo/feriado no payout (ADR-011)
--
-- Config do tenant para o +15% em execuções com sucesso em domingo/feriado:
--   feriado_acrescimo_pct : percentual (default 15)
--   feriados              : lista de datas "YYYY-MM-DD" (mantida pelo gestor)
--
-- Domingo é detectado pela data da visita (não precisa de lista). Feriados ativam
-- conforme as datas cadastradas — a lista abaixo começa VAZIA; o gestor fornece as
-- datas (nacionais + SC + específicas) para semear aqui ou via UPDATE.
--
-- Aplicar manualmente via Supabase SQL Editor. Idempotente (jsonb_set).
-- =============================================================================

UPDATE tenants
SET config = jsonb_set(
  jsonb_set(config, '{feriado_acrescimo_pct}', '15'::jsonb, true),
  '{feriados}',
  COALESCE(config -> 'feriados', '[]'::jsonb),  -- preserva a lista se já existir
  true
)
WHERE slug = 'wave';

-- Exemplo para semear feriados depois (substituir pelas datas reais e rodar):
-- UPDATE tenants
-- SET config = jsonb_set(config, '{feriados}',
--   '["2026-01-01","2026-04-21","2026-05-01","2026-09-07","2026-10-12",
--     "2026-11-02","2026-11-15","2026-11-20","2026-12-25"]'::jsonb, true)
-- WHERE slug = 'wave';

-- Controle
SELECT 'feriado_acrescimo_pct' AS chave, config -> 'feriado_acrescimo_pct' AS valor
FROM tenants WHERE slug = 'wave';
