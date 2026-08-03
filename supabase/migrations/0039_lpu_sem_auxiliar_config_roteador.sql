-- =============================================================================
-- 0039 — "Configuração de Roteador Externo" na LPU "SEM AUXILIAR" (ADR-014 + ADR-019)
--
-- Nada aqui toca a LPU padrão ("LPU Wave 2026 — Revisada"), suas regras ou os pagamentos de
-- técnicos fora da tabela SEM AUXILIAR: o INSERT carrega o `lpu_id` da SEM AUXILIAR e o
-- DELETE filtra por ele.
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Idempotente. Depende da 0036.
--
-- ── PROBLEMA: OS 572037 fica em "Sem regra de LPU" e não paga nada ────────────────────────
-- A finalidade "Configuração de Roteador Externo" existe na tabela padrão como regra explícita
-- de R$ 0 ("Configuração de Roteador (não repassada ao técnico)", prioridade 100), mas a
-- SEM AUXILIAR nunca a declarou. Sem regra que case, o payout sai `no_rule_match` — que não
-- paga E trava o fechamento até alguém resolver.
--
-- Não é falha do motor nem herança: regra de LPU **não** tem herança entre tabelas (só as
-- classificações de cabeamento/homologação têm — ADR-019). Uma finalidade que a tabela
-- alternativa não cobre simplesmente não casa nada.
--
-- ── DECISÃO (Jhoni, 03/08/2026): vale R$ 30 na SEM AUXILIAR ───────────────────────────────
-- Mesmo valor do suporte interno da tabela nova, e o mesmo que o ADR-016 já repassa quando o
-- roteador chega pela finalidade "Venda Produto Externo" com a coluna Z "Roteador | 50 ...".
--
-- Alcance medido em 03/08/2026: **1 visita** — OS 572037 (09/07, Douglas Ribeiro, Interno,
-- receita R$ 64,46), hoje `no_rule_match` sem ajuste manual. É a única visita com essa
-- finalidade em toda a base, dos dois lados. Vai para R$ 30 no próximo "Recalcular pendentes".
--
-- ⚠️ A tabela PADRÃO segue pagando R$ 0 nessa finalidade, como está desde o seed. Nenhum
-- técnico da padrão tem visita assim (0 na base), então nada muda hoje — mas, quando tiver, a
-- Wave vai querer decidir se lá também são R$ 30. Registrado em docs/tech-debt.md (024).
-- =============================================================================

DELETE FROM lpu_rules
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR')
  AND description = 'Configuração de Roteador Externo';

INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
SELECT l.id,
       '{"finalidade":"Configuração de Roteador Externo"}'::jsonb,
       '{"type":"fixed","value":30}'::jsonb,
       'Configuração de Roteador Externo',
       100
FROM lpus l
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- ── Conferência 1: a regra entrou só na SEM AUXILIAR ──────────────────────────────────────
-- Esperado: 2 linhas — padrão com R$ 0 (do seed) e SEM AUXILIAR com R$ 30 (esta migration).
SELECT l.nome AS tabela, r.description, r.prioridade, r.payout ->> 'value' AS valor, r.ativa
FROM lpu_rules r
JOIN lpus l ON l.id = r.lpu_id
WHERE r.conditions ->> 'finalidade' = 'Configuração de Roteador Externo'
ORDER BY l.nome;

-- ── Conferência 2: o que o recálculo deve corrigir ────────────────────────────────────────
-- Rodar DEPOIS de "Recalcular pendentes": esperado R$ 30,00 na OS 572037, status pending_review.
SELECT sv.os_num, sv.data_execucao::date AS data, sv.tipo_atendimento,
       sv.valor_recebido_unetvale AS receita, p.valor_calculado, p.status
FROM payouts p
JOIN service_visits sv ON sv.id = p.visit_id
WHERE sv.finalidade = 'Configuração de Roteador Externo'
ORDER BY sv.data_execucao;
