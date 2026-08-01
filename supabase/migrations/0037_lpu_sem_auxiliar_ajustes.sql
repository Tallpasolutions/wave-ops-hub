-- =============================================================================
-- 0037 — Dois ajustes na LPU "SEM AUXILIAR" (ADR-014 + ADR-019)
--
-- Nada aqui toca a LPU padrão ("LPU Wave 2026 — Revisada"), suas regras, suas classificações
-- ou os pagamentos de técnicos que não estão na tabela SEM AUXILIAR. Todo filtro é por
-- `lpus.nome = 'LPU Wave — SEM AUXILIAR'` ou por técnico vinculado a ela.
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Idempotente. Depende da 0035 e da 0036.
--
-- ── PROBLEMA 1: improdutiva paga R$ 15 em vez dos R$ 10 da tabela nova ────────────────────
-- A LPU já declara `improdutiva_valor = 10` e o motor já lê esse valor. O que impede o efeito
-- é o STATUS: a improdutiva padrão (Unetvale R$ 15,98) é auto-aprovada pelo próprio cálculo
-- (`status = 'approved'`), e o recálculo NUNCA reprocessa payout aprovado — invariante da
-- Sprint 4, reforçada na 0034. Quando o gestor atribuiu os técnicos à tabela nova, o recálculo
-- pulou todas essas linhas e elas seguiram com o valor da tabela padrão.
--
-- Aqui elas voltam para 'pending' para que o recálculo as reprocesse. É seguro porque essa
-- aprovação foi AUTOMÁTICA, não decisão humana: o filtro exige `override_by IS NULL` (nenhum
-- ajuste manual), `closing_id IS NULL` (fora de fechamento), valor exatamente R$ 15,00 e
-- receita exatamente R$ 15,98 — a assinatura da regra automática. Mesmo padrão da 0019.
-- Medido em 30/07/2026: 168 payouts, nenhum pago, nenhum em fechamento (R$ 840 no total).
--
-- ── PROBLEMA 2: "segundo cliente ou ftta de um condomínio" paga R$ 70 em vez de R$ 60 ─────
-- OS 575090 (Instalação) e 565248 (Cabeamento) são o mesmo serviço, por dois caminhos:
--   · Instalação/Mudança em condomínio → motor de LPU. As regras de condomínio distinguem
--     aéreo (R$ 150) e subterrâneo (R$ 70) porque valem para a instalação NOVA, que traz a
--     fibra da rua (receita da Unetvale R$ 309 a R$ 412). O "segundo cliente/ftta" só liga
--     mais um cliente à infra existente (do DG até o AP, receita R$ 103,13) — é a linha de
--     R$ 60 da planilha, e casava a regra errada por ter meio e tipo preenchidos.
--   · Cabeamento Fibra → classificação por coluna Z (ADR-009). A LPU nova não declarava essa
--     chave, então herdava os R$ 70 do tenant (herança por chave, ADR-019).
--
-- Discriminante: receita da Unetvale R$ 103,13 (96,80 × 1,0654). Verificado no banco — entre
-- R$ 100 e R$ 110, em condomínio, existem 43 visitas e SÓ as duas explicações do segundo
-- cliente/ftta; nenhuma instalação nova cai nessa faixa.
--
-- Alcance nos 3 técnicos da tabela nova: 14 visitas em R$ 70 e 3 em R$ 150 vão para R$ 60;
-- 8 já pagavam R$ 60 (casaram a regra genérica) e ficam iguais; 1 tem ajuste manual do gestor
-- e é preservada pelo recálculo.
-- =============================================================================

-- ── 1. Regra: segundo cliente / ftta de condomínio → R$ 60 ────────────────────────────────
-- Prioridade 500: vence as de condomínio (400) e a genérica (200). Também cobre o caso aéreo
-- (R$ 150), que é o mesmo serviço — sem isso o mesmo trabalho teria três valores diferentes
-- conforme o preenchimento de meio/tipo na planilha.
DELETE FROM lpu_rules
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR')
  AND description = 'Instalação Condomínio segundo cliente ou FTTA (do DG até o AP)';

INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
SELECT l.id,
       '{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":true,"valorRecebidoUnetvale":{"min":100,"max":110}}'::jsonb,
       '{"type":"fixed","value":60}'::jsonb,
       'Instalação Condomínio segundo cliente ou FTTA (do DG até o AP)',
       500
FROM lpus l
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- ── 2. Classificação de cabeamento do mesmo serviço → R$ 60 ───────────────────────────────
DELETE FROM cabeamento_classifications
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR')
  AND explicacao_key = 'Cabeamento do segundo cliente ou ftta de um condomínio';

INSERT INTO cabeamento_classifications
  (tenant_id, lpu_id, explicacao_original, explicacao_key, valor, observacao)
SELECT l.tenant_id, l.id,
       'Cabeamento do segundo cliente ou ftta de um condomínio',
       'Cabeamento do segundo cliente ou ftta de um condomínio',
       60,
       'SEM AUXILIAR: segundo cliente/FTTA — mesmo serviço da regra de instalação (0037)'
FROM lpus l
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- ── 3. Reabre as improdutivas auto-aprovadas dos técnicos da tabela nova ──────────────────
-- Só as que carregam a assinatura da regra automática. Aprovação manual, ajuste do gestor,
-- payout em fechamento e payout pago ficam intocados.
UPDATE payouts p
SET status = 'pending'
FROM service_visits sv
JOIN technicians t ON t.id = sv.tecnico_id
JOIN lpus l ON l.id = t.lpu_id
WHERE p.visit_id = sv.id
  AND l.nome = 'LPU Wave — SEM AUXILIAR'
  AND p.status = 'approved'
  AND p.override_by IS NULL
  AND p.closing_id IS NULL
  AND round(p.valor_calculado, 2) = 15.00
  AND round(sv.valor_recebido_unetvale, 2) = 15.98
  AND lower(btrim(sv.sucesso)) NOT LIKE 'sim%';

-- ── Conferência 1: a LPU padrão continua intocada ─────────────────────────────────────────
-- Esperado: os três valores NULL e a contagem de regras inalterada (18 na padrão).
SELECT l.nome, l.ativa, l.ponto_adicional_valor, l.improdutiva_valor, l.feriado_acrescimo_pct,
       (SELECT count(*) FROM lpu_rules r WHERE r.lpu_id = l.id) AS regras
FROM lpus l ORDER BY l.ativa DESC, l.nome;

-- ── Conferência 2: improdutivas reabertas, prontas para o recálculo ───────────────────────
-- Esperado: ~168 em 'pending' com valor 15,00 (viram 10,00 após "Recalcular pendentes").
SELECT p.status, count(*) AS total, min(p.valor_calculado) AS valor
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
JOIN technicians t ON t.id = sv.tecnico_id
JOIN lpus l ON l.id = t.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR'
  AND round(sv.valor_recebido_unetvale, 2) = 15.98
  AND lower(btrim(sv.sucesso)) NOT LIKE 'sim%'
GROUP BY p.status ORDER BY total DESC;

-- ── Conferência 3: o que o recálculo deve corrigir no segundo cliente/FTTA ────────────────
-- Rodar DEPOIS de "Recalcular pendentes": esperado R$ 60,00 em todas, menos a que tem
-- ajuste manual do gestor (preservada de propósito).
SELECT sv.os_num, sv.data_execucao::date AS data, sv.finalidade,
       sv.subterraneo_aereo AS meio, p.valor_calculado, p.valor_override,
       CASE WHEN p.override_by IS NOT NULL THEN 'ajuste manual' ELSE '' END AS observacao
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
JOIN technicians t ON t.id = sv.tecnico_id
JOIN lpus l ON l.id = t.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR'
  AND round(sv.valor_recebido_unetvale, 2) = 103.13
  AND lower(btrim(sv.sucesso)) LIKE 'sim%'
ORDER BY sv.data_execucao;
