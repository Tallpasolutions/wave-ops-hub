-- =============================================================================
-- 0047 — Remove as visitas de outras empresas que entraram por planilha (ADR-024)
--
-- IRREVERSÍVEL. Antes: aplicar a 0046 e conferir com
-- `supabase/2026-11-conferencia-outras-empresas.sql` se a linha 'remove' traz só o que deve sair.
--
-- ── O QUE ACONTECEU ──────────────────────────────────────────────────────────────────────
-- Em 03/11/2026 a planilha `lista-os-wave01-10--03-11.xlsx` veio com todas as empresas da
-- Unetvale: 5.980 linhas, das quais só 674 da Wave (contagem pelo CSV de mesmo total). O upload
-- registrou 5.478 inseridas, e as outras empresas apareceram em "Técnicos sem vínculo".
--
-- ── O QUE SAI E O QUE FICA ───────────────────────────────────────────────────────────────
-- Sai a VISITA, nunca a OS: há OSs com visitas da Wave e de outra empresa, e a da Wave fica.
-- Payout, auditoria e alterações da visita saem junto (FK ON DELETE CASCADE) e o trigger
-- reconsolida `service_orders`. O payout é calculado por visita, então o valor da Wave não muda.
--
-- Não toca em: nome sem prefixo, visita com técnico vinculado e payout aprovado, pago,
-- contestado ou com ajuste do gestor. Esses aparecem como 'protegida' na conferência.
--
-- ── COMO RODAR ───────────────────────────────────────────────────────────────────────────
-- Rodar cada statement separado (ver 0036). O primeiro apaga 1.000 visitas por vez, porque o
-- trigger roda linha a linha e um único DELETE arrisca estourar o tempo do SQL Editor. Repetir
-- até responder 0 linhas e só então rodar o segundo. Rodar de novo não faz nada.
-- =============================================================================

DELETE FROM service_visits
WHERE id IN (
  SELECT v.id
  FROM service_visits v
  JOIN tenants t ON t.id = v.tenant_id AND t.config ? 'prefixos_empresa'
  LEFT JOIN payouts p ON p.visit_id = v.id
  CROSS JOIN LATERAL (
    SELECT upper(regexp_replace(btrim(substring(btrim(v.tecnico_raw) FROM '^(.+?)(\s+-\s*|\s*-\s+)')), '\s+', ' ', 'g')) AS empresa
  ) e
  WHERE e.empresa IS NOT NULL
    AND NOT (t.config -> 'prefixos_empresa') ? e.empresa
    AND v.tecnico_id IS NULL
    AND NOT COALESCE(p.status IN ('approved', 'paid', 'contestado') OR p.override_by IS NOT NULL, false)
  LIMIT 1000
);

-- Motivos auto-criados por essas linhas ficariam na fila de classificação sem nenhuma visita.
-- Se a Wave tiver o motivo de novo, a ingestão recria.
DELETE FROM reasons r
USING tenants t
WHERE t.id = r.tenant_id
  AND t.config ? 'prefixos_empresa'
  AND r.categoria = 'pendente_classificacao'
  AND NOT EXISTS (SELECT 1 FROM service_visits v WHERE v.reason_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.reason_id = r.id);
