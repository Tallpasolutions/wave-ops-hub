-- =============================================================================
-- 0038 — Cabeamento de fibra aérea/subterrânea na LPU "SEM AUXILIAR" (ADR-019)
--
-- Nada aqui toca a LPU padrão ("LPU Wave 2026 — Revisada"), suas classificações ou os
-- pagamentos de técnicos fora da tabela SEM AUXILIAR: todo INSERT carrega o `lpu_id` da
-- SEM AUXILIAR e todo DELETE filtra por ele.
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Idempotente. Depende da 0035 e da 0036.
--
-- ── PROBLEMA: OS 569827 paga R$ 120 e deveria pagar R$ 100 ────────────────────────────────
-- "Cabeamento Fibra" não passa pelo motor de LPU — o valor vem da classificação por coluna Z
-- (ADR-009). A 0036 cadastrou só as chaves-base da SEM AUXILIAR ("Cabeamento" e "Cabeamento
-- agregado"); "Cabeamento fibra aérea" e "Cabeamento fibra subterrênea" ficaram de fora e,
-- pela herança por chave (ADR-019, decisão 3), seguiram pagando o valor do tenant: R$ 120 e
-- R$ 135. Não é bug do motor — é chave que faltou declarar.
--
-- ── DECISÃO (Jhoni, 03/08/2026): as duas valem R$ 100 na SEM AUXILIAR ─────────────────────
-- É o mesmo padrão do resto da tabela: a distinção aéreo/subterrâneo da tabela padrão
-- (120/135) não existe na SEM AUXILIAR, onde instalação e suporte pagam R$ 100 nos dois meios.
--
-- Alcance medido em 03/08/2026 (3 técnicos na tabela nova): 8 visitas com sucesso — 4 aéreas
-- em R$ 120 e 4 subterrâneas em R$ 135, todas `pending_review`, nenhuma com ajuste manual,
-- nenhuma em fechamento. Vão para R$ 100 no próximo "Recalcular pendentes" (−R$ 220 no total).
--
-- A grafia "subterrênea" é a da planilha da Unetvale e é a chave real no banco — não corrigir.
-- =============================================================================

DELETE FROM cabeamento_classifications
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR')
  AND explicacao_key IN ('Cabeamento fibra aérea', 'Cabeamento fibra subterrênea');

INSERT INTO cabeamento_classifications
  (tenant_id, lpu_id, explicacao_original, explicacao_key, valor, observacao)
SELECT l.tenant_id, l.id, x.chave, x.chave, x.valor, x.obs
FROM lpus l
CROSS JOIN (VALUES
  ('Cabeamento fibra aérea',       100::numeric, 'SEM AUXILIAR: cabeamento de fibra aérea (0038)'),
  ('Cabeamento fibra subterrênea', 100::numeric, 'SEM AUXILIAR: cabeamento de fibra subterrânea (0038)')
) AS x(chave, valor, obs)
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- ── Conferência 1: a LPU padrão continua com os valores dela ──────────────────────────────
-- Esperado: aérea R$ 120 e subterrênea R$ 135 no tenant (lpu_id NULL), R$ 100 na SEM AUXILIAR.
SELECT COALESCE(l.nome, '(tenant — tabela padrão)') AS escopo,
       c.explicacao_key, c.valor
FROM cabeamento_classifications c
LEFT JOIN lpus l ON l.id = c.lpu_id
WHERE c.explicacao_key IN ('Cabeamento fibra aérea', 'Cabeamento fibra subterrênea')
ORDER BY escopo, c.explicacao_key;

-- ── Conferência 2: o que o recálculo deve corrigir ────────────────────────────────────────
-- Rodar DEPOIS de "Recalcular pendentes": esperado R$ 100,00 nas 8 visitas (OS 569827 entre
-- elas). Payout com ajuste manual do gestor, se aparecer algum, é preservado de propósito.
SELECT sv.os_num, sv.data_execucao::date AS data,
       regexp_replace(sv.explicacao_valor, '\s*\|.*$', '') AS servico,
       p.valor_calculado, p.valor_override, p.status,
       CASE WHEN p.override_by IS NOT NULL THEN 'ajuste manual' ELSE '' END AS observacao
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
JOIN technicians t ON t.id = sv.tecnico_id
JOIN lpus l ON l.id = t.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR'
  AND sv.explicacao_valor ILIKE 'Cabeamento fibra%'
  AND lower(btrim(sv.sucesso)) LIKE 'sim%'
ORDER BY sv.data_execucao;
