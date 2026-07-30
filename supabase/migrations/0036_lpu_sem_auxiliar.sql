-- =============================================================================
-- 0036 — LPU "SEM AUXILIAR" (ADR-014 + ADR-019)
--
-- Fonte dos valores: docs/domain/anexos/lpu-sem-auxiliar-2026-07.xlsx (Wave, 30/07/2026).
-- O mapeamento linha a linha e as decisões estão no ADR-019 e na Sprint 18 — aqui só o SQL.
--
-- A LPU nasce INATIVA: `ativa = true` significa "tabela padrão do tenant", não "em uso". A
-- alternativa é aplicada aos técnicos que a tiverem em `technicians.lpu_id` (ADR-014). Criar
-- esta LPU não muda nenhum pagamento até o gestor atribuí-la a alguém em /equipe/tecnicos/[id].
-- A tabela em uso hoje não é tocada em nenhum ponto.
--
-- SEM bloco DO $$ de propósito: o SQL Editor do Supabase truncou a versão anterior no meio de
-- um comentário e ainda tentou tratar as variáveis do DECLARE como tabelas ("ALTER TABLE
-- v_tenant_id ENABLE ROW LEVEL SECURITY"). Cada statement abaixo é independente e resolve a
-- LPU por (tenant, nome), então rodar statement a statement funciona.
--
-- Idempotente: recria as regras e as classificações desta LPU do zero. Depende da 0035.
-- =============================================================================

-- 1. A LPU (só cria se ainda não existir)
INSERT INTO lpus (tenant_id, nome, vigencia_inicio, ativa)
SELECT t.id, 'LPU Wave — SEM AUXILIAR', '2026-08-01', false
FROM tenants t
WHERE (t.slug = 'wave' OR t.dominio_custom ILIKE '%wave%')
  AND NOT EXISTS (
    SELECT 1 FROM lpus l WHERE l.tenant_id = t.id AND l.nome = 'LPU Wave — SEM AUXILIAR'
  );

-- 2. Valores próprios da tabela (ADR-019). Ponto R$ 30 e improdutiva R$ 10 vêm da planilha;
--    feriado 10% é a linha da tabela (o nome do serviço diz 15% — decisão do usuário 30/07).
UPDATE lpus
SET ponto_adicional_valor = 30, improdutiva_valor = 10, feriado_acrescimo_pct = 10
WHERE nome = 'LPU Wave — SEM AUXILIAR';

-- 3. Regras: recriadas do zero a cada execução
DELETE FROM lpu_rules
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR');

INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
SELECT l.id, x.cond, x.pay, x.descr, x.prio
FROM lpus l
CROSS JOIN (VALUES
  -- Garantia não paga (prioridade 900, acima de tudo). Cobre as 7 linhas com "-" da planilha.
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"garantia":true}'::jsonb,
   '{"type":"fixed","value":0}'::jsonb, 'Instalação em garantia (não paga)', 900),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"garantia":true}'::jsonb,
   '{"type":"fixed","value":0}'::jsonb, 'Suporte em garantia (não paga)', 900),

  -- Suporte externo SEM troca de drop (500). Mesma trava da 0032 na tabela padrão.
  -- INFERÊNCIA (a planilha não distingue): valor do suporte simples da própria tabela, R$ 30.
  -- Remover estas 4 se a Wave quiser pagar R$ 100 em qualquer suporte externo.
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Aéreo","agregada":false,"valorRecebidoUnetvale":{"min":40,"max":150}}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Aéreo Externo sem troca de drop', 500),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Subterrâneo","agregada":false,"valorRecebidoUnetvale":{"min":40,"max":150}}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Subterrâneo Externo sem troca de drop', 500),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Aéreo","agregada":true,"valorRecebidoUnetvale":{"min":40,"max":150}}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Aéreo Externo sem troca de drop + venda atrelada', 500),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Subterrâneo","agregada":true,"valorRecebidoUnetvale":{"min":40,"max":150}}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Subterrâneo Externo sem troca de drop + venda atrelada', 500),

  -- Suporte externo com troca de drop (400) — planilha: 100 em todas as variações
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Aéreo","agregada":false}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Suporte de Fibra aérea', 400),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Subterrâneo","agregada":false}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Suporte de Fibra subterrânea', 400),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Aéreo","agregada":true}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Suporte de Fibra aérea + venda atrelada', 400),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Externo","subterraneaAereo":"Subterrâneo","agregada":true}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Suporte de Fibra subterrânea + venda atrelada', 400),

  -- Instalação em condomínio (400 / 200)
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":true,"subterraneaAereo":"Aéreo","tipoAtendimento":"Externo"}'::jsonb,
   '{"type":"fixed","value":150}'::jsonb, 'Instalação Condomínio externo aéreo + do DG até o AP', 400),
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":true,"subterraneaAereo":"Subterrâneo","tipoAtendimento":"Externo"}'::jsonb,
   '{"type":"fixed","value":70}'::jsonb, 'Instalação Condomínio externo subterrâneo + do DG até o AP', 400),
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":true}'::jsonb,
   '{"type":"fixed","value":60}'::jsonb, 'Instalação Condomínio do DG até o AP', 200),

  -- Instalação fora de condomínio (300)
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":false,"subterraneaAereo":"Aéreo"}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Instalação aérea', 300),
  ('{"finalidade":["Instalação - Fibra - PF","Instalação - Fibra - PJ","Mudança Endereço Fibra"],"condominio":false,"subterraneaAereo":"Subterrâneo"}'::jsonb,
   '{"type":"fixed","value":100}'::jsonb, 'Instalação subterrânea', 300),

  -- Suporte interno (300). "Retenção", "Configuração/Garantia" e "Rádio" (todos 30) caem aqui.
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Interno","agregada":false}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Fibra Interno', 300),
  ('{"finalidade":["Suporte Fibra","Suporte","Suporte Condomínio","Troca de Equipamentos","Troca de Equipamentos de Local"],"tipoAtendimento":"Interno","agregada":true}'::jsonb,
   '{"type":"fixed","value":30}'::jsonb, 'Suporte Fibra Interno + venda de roteador atrelada', 300),

  -- Retirada (100)
  ('{"finalidade":"Retirada"}'::jsonb, '{"type":"fixed","value":20}'::jsonb, 'Retirada', 100)
) AS x(cond, pay, descr, prio)
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- 4. Classificações de cabeamento próprias (ADR-009 + 0035).
--    Só as chaves-BASE: a planilha confirma 30 por dois caminhos — "ponto dentro da casa +
--    segundo ponto" = 60 (30 + 1 ponto de 30) e "3 pontos" = 90 (30 + 2 × 30), que é o que o
--    motor calcula sozinho com o ponto de R$ 30 desta LPU.
--    Chaves não declaradas (cabeamento fibra aérea/subterrânea, segundo cliente, retirada
--    condomínio) seguem pagando o valor do tenant — o motor faz merge por chave.
DELETE FROM cabeamento_classifications
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR');

INSERT INTO cabeamento_classifications
  (tenant_id, lpu_id, explicacao_original, explicacao_key, valor, observacao)
SELECT l.tenant_id, l.id, x.orig, x.chave, x.valor, x.obs
FROM lpus l
CROSS JOIN (VALUES
  ('Cabeamento', 'Cabeamento', 30::numeric, 'SEM AUXILIAR: cabeamento/segundo ponto'),
  ('Cabeamento agregado', 'Cabeamento agregado', 30::numeric, 'SEM AUXILIAR: cabeamento agregado a outra OS')
) AS x(orig, chave, valor, obs)
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- 5. Repasse de homologação próprio (ADR-015 + 0035). A planilha traz só a base (30); os
--    demais valores de Unetvale seguem herdando os do tenant.
DELETE FROM homologacao_classifications
WHERE lpu_id IN (SELECT id FROM lpus WHERE nome = 'LPU Wave — SEM AUXILIAR');

INSERT INTO homologacao_classifications
  (tenant_id, lpu_id, valor_unetvale, valor_repasse, observacao)
SELECT l.tenant_id, l.id, 64.46, 30, 'SEM AUXILIAR: homologação base (planilha 30/07/2026)'
FROM lpus l
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';

-- ── Conferência 1: a tabela padrão continua intocada (os três valores NULL) ───────────────
SELECT nome, ativa, ponto_adicional_valor, improdutiva_valor, feriado_acrescimo_pct
FROM lpus ORDER BY ativa DESC, nome;

-- ── Conferência 2: as 18 regras da SEM AUXILIAR, na ordem em que o motor as avalia ────────
-- Esperado: 2 de garantia (R$ 0) · 4 sem troca de drop (30) · 4 suporte externo (100) ·
--           3 condomínio (150/70/60) · 2 instalação (100) · 2 suporte interno (30) · retirada (20)
SELECT r.prioridade, r.description, r.payout ->> 'value' AS valor
FROM lpu_rules r
JOIN lpus l ON l.id = r.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR'
ORDER BY r.prioridade DESC, r.description;

-- ── Conferência 3: classificações próprias e técnicos atribuídos (esperado: 2, 1 e 0) ─────
SELECT
  (SELECT count(*) FROM cabeamento_classifications c
     JOIN lpus l ON l.id = c.lpu_id WHERE l.nome = 'LPU Wave — SEM AUXILIAR')  AS cabeamento_da_lpu,
  (SELECT count(*) FROM homologacao_classifications h
     JOIN lpus l ON l.id = h.lpu_id WHERE l.nome = 'LPU Wave — SEM AUXILIAR')  AS homologacao_da_lpu,
  (SELECT count(*) FROM technicians t
     JOIN lpus l ON l.id = t.lpu_id WHERE l.nome = 'LPU Wave — SEM AUXILIAR')  AS tecnicos_atribuidos;
