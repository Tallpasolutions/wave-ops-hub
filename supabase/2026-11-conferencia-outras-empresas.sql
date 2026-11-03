-- Conferência da 0047 (ADR-024). Somente leitura. Rodar DEPOIS da 0046, porque lê a lista de empresas
-- do tenant, e rodar de novo depois da 0047: o que sobrar são as linhas que ela protegeu de propósito.
--
-- Como ler:
--   decisao = 'fica'             empresa do tenant, ou nome sem prefixo reconhecível
--   decisao = 'remove'           a 0047 apaga
--   decisao = 'protegida'        é de outra empresa, mas tem técnico vinculado ou pagamento travado.
--                                A 0047 não toca. Olhar uma a uma antes de decidir.

SELECT
  sub.empresa,
  sub.decisao,
  COUNT(*)                                          AS visitas,
  COUNT(*) FILTER (WHERE sub.fora_escopo)           AS fora_de_escopo,
  COUNT(*) FILTER (WHERE sub.tecnico_id IS NOT NULL) AS com_tecnico_vinculado,
  COUNT(*) FILTER (WHERE sub.travado)               AS com_pagamento_travado,
  COUNT(DISTINCT sub.os_num)                        AS oss,
  MIN(sub.data_execucao)::date                      AS primeira_visita,
  MAX(sub.data_execucao)::date                      AS ultima_visita,
  COUNT(DISTINCT sub.upload_id)                     AS uploads
FROM (
  SELECT
    v.os_num,
    v.upload_id,
    v.tecnico_id,
    v.fora_escopo,
    v.data_execucao,
    COALESCE(e.empresa, '(sem prefixo)') AS empresa,
    COALESCE(p.status IN ('approved', 'paid', 'contestado') OR p.override_by IS NOT NULL, false) AS travado,
    CASE
      WHEN e.empresa IS NULL OR (t.config -> 'prefixos_empresa') ? e.empresa THEN 'fica'
      WHEN v.tecnico_id IS NOT NULL
        OR COALESCE(p.status IN ('approved', 'paid', 'contestado') OR p.override_by IS NOT NULL, false)
        THEN 'protegida'
      ELSE 'remove'
    END AS decisao
  FROM service_visits v
  JOIN tenants t ON t.id = v.tenant_id AND t.config ? 'prefixos_empresa'
  LEFT JOIN payouts p ON p.visit_id = v.id
  CROSS JOIN LATERAL (
    SELECT upper(regexp_replace(btrim(substring(btrim(v.tecnico_raw) FROM '^(.+?)(\s+-\s*|\s*-\s+)')), '\s+', ' ', 'g')) AS empresa
  ) e
) sub
GROUP BY sub.empresa, sub.decisao
ORDER BY sub.decisao, visitas DESC;
