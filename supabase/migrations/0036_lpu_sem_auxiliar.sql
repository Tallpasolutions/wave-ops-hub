-- =============================================================================
-- 0036 — LPU "SEM AUXILIAR" (ADR-014 + ADR-019)
--
-- Tabela de preços da Wave para serviço executado SEM técnico auxiliar. Fonte:
-- docs/domain/anexos/lpu-sem-auxiliar-2026-07.xlsx (recebida em 30/07/2026).
--
-- Nasce INATIVA de propósito: `lpus.ativa = true` significa "tabela padrão do tenant", não
-- "em uso". O trigger trg_single_active_lpu só admite uma ativa, e a alternativa é aplicada
-- pelos técnicos que a tiverem atribuída em `technicians.lpu_id` (ADR-014) — o motor resolve
-- por visita. Criar esta LPU NÃO muda nenhum pagamento: nada acontece até o gestor atribuí-la
-- a um técnico em /equipe/tecnicos/[id].
--
-- A tabela em uso hoje não é tocada por esta migration em nenhum ponto.
--
-- FORMA DE EXECUÇÃO: SQL Editor. Idempotente (recria as regras da LPU do zero a cada execução,
-- sem tocar em nenhuma outra LPU). Depende da 0035 (colunas de valores por LPU).
-- =============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_lpu_id    UUID;
  inst_fin    JSONB := '["Instalação - Fibra - PF", "Instalação - Fibra - PJ", "Mudança Endereço Fibra"]';
  sup_fin     JSONB := '["Suporte Fibra", "Suporte", "Suporte Condomínio", "Troca de Equipamentos", "Troca de Equipamentos de Local"]';
BEGIN
  SELECT id INTO v_tenant_id FROM tenants
  WHERE slug = 'wave' OR dominio_custom ILIKE '%wave%' LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant Wave não encontrado.';
  END IF;

  -- ── A LPU ────────────────────────────────────────────────────────────────────────────
  -- Valores próprios (ADR-019, migration 0035). A tabela padrão deixa os três NULL e por
  -- isso segue com R$ 36 / R$ 15 / 15%.
  --   ponto adicional R$ 30 — a planilha confirma por dois caminhos: instalação 100 → 130
  --     com ponto, e suporte interno 30 → 60 com ponto.
  --   improdutiva     R$ 10 — linha "Visita improdutiva".
  --   feriado         10%   — a planilha diz "15%" no nome do serviço e "10%" no valor; o
  --     usuário decidiu (30/07) que vale o que está declarado na linha da tabela nova.
  SELECT id INTO v_lpu_id FROM lpus
  WHERE tenant_id = v_tenant_id AND nome = 'LPU Wave — SEM AUXILIAR';

  IF v_lpu_id IS NULL THEN
    INSERT INTO lpus (tenant_id, nome, vigencia_inicio, ativa,
                      ponto_adicional_valor, improdutiva_valor, feriado_acrescimo_pct)
    VALUES (v_tenant_id, 'LPU Wave — SEM AUXILIAR', '2026-08-01', false, 30, 10, 10)
    RETURNING id INTO v_lpu_id;
    RAISE NOTICE 'LPU SEM AUXILIAR criada (inativa): %', v_lpu_id;
  ELSE
    UPDATE lpus
    SET ponto_adicional_valor = 30, improdutiva_valor = 10, feriado_acrescimo_pct = 10
    WHERE id = v_lpu_id;
    RAISE NOTICE 'LPU SEM AUXILIAR já existia (%) — valores reaplicados.', v_lpu_id;
  END IF;

  -- Recria as regras do zero: idempotência sem depender de casar condições JSONB uma a uma.
  DELETE FROM lpu_rules WHERE lpu_id = v_lpu_id;

  -- ── Garantia não paga (prioridade 900, acima de tudo) ────────────────────────────────
  -- Sete linhas da planilha marcam "-" para serviço em garantia (instalação aérea/subterrânea
  -- com garantia, condomínio DG-AP menos garantia, suporte aéreo/subterrâneo/retenção/interno
  -- com garantia). Uma regra por família cobre todas: `garantia` é condição do motor.
  -- Prioridade explícita porque a automática (nº de condições × 100) perderia das regras de
  -- serviço, que têm mais condições.
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade) VALUES
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'garantia', true),
     '{"type":"fixed","value":0}', 'Instalação em garantia (não paga)', 900),
    (v_lpu_id, jsonb_build_object('finalidade', sup_fin, 'garantia', true),
     '{"type":"fixed","value":0}', 'Suporte em garantia (não paga)', 900);

  -- ── Suporte externo SEM troca de drop (prioridade 500) ───────────────────────────────
  -- Mesma trava da migration 0032 na tabela padrão, pelo mesmo motivo: as regras de suporte
  -- externo valem para o serviço COM troca de drop (receita Unetvale ~R$ 206/~R$ 232). Sem
  -- este corte, um suporte simples (receita R$ 64,46) casaria a regra de R$ 100.
  -- ⚠️ INFERÊNCIA: a planilha não distingue os dois casos. Adotado o valor do suporte simples
  -- da própria tabela (R$ 30, linha "Suporte Fibra Interno"). Remover estas 4 regras se a
  -- Wave quiser pagar R$ 100 em qualquer suporte externo.
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  SELECT v_lpu_id,
         jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Externo',
                            'subterraneaAereo', m.meio, 'agregada', m.agregada,
                            'valorRecebidoUnetvale', jsonb_build_object('min', 40, 'max', 150)),
         '{"type":"fixed","value":30}', m.descricao, 500
  FROM (VALUES
    ('Aéreo',       false, 'Suporte Aéreo Externo sem troca de drop'),
    ('Subterrâneo', false, 'Suporte Subterrâneo Externo sem troca de drop'),
    ('Aéreo',       true,  'Suporte Aéreo Externo sem troca de drop + venda atrelada'),
    ('Subterrâneo', true,  'Suporte Subterrâneo Externo sem troca de drop + venda atrelada')
  ) AS m(meio, agregada, descricao);

  -- ── Suporte externo (prioridade 400) ─────────────────────────────────────────────────
  -- Planilha: aérea 100 · subterrânea 100 · ambas "mais venda atrelada" também 100.
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  SELECT v_lpu_id,
         jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Externo',
                            'subterraneaAereo', m.meio, 'agregada', m.agregada),
         '{"type":"fixed","value":100}', m.descricao, 400
  FROM (VALUES
    ('Aéreo',       false, 'Suporte de Fibra aérea'),
    ('Subterrâneo', false, 'Suporte de Fibra subterrânea'),
    ('Aéreo',       true,  'Suporte de Fibra aérea + venda atrelada'),
    ('Subterrâneo', true,  'Suporte de Fibra subterrânea + venda atrelada')
  ) AS m(meio, agregada, descricao);

  -- ── Instalação em condomínio (prioridade 400 / 200) ──────────────────────────────────
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade) VALUES
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'condominio', true,
                                  'subterraneaAereo', 'Aéreo', 'tipoAtendimento', 'Externo'),
     '{"type":"fixed","value":150}', 'Instalação Condomínio externo aéreo + do DG até o AP', 400),
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'condominio', true,
                                  'subterraneaAereo', 'Subterrâneo', 'tipoAtendimento', 'Externo'),
     '{"type":"fixed","value":70}', 'Instalação Condomínio externo subterrâneo + do DG até o AP', 400),
    -- Genérica: qualquer instalação em condomínio não coberta acima ("do DG até o AP").
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'condominio', true),
     '{"type":"fixed","value":60}', 'Instalação Condomínio do DG até o AP', 200);

  -- ── Instalação fora de condomínio (prioridade 300) ───────────────────────────────────
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade) VALUES
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'condominio', false,
                                  'subterraneaAereo', 'Aéreo'),
     '{"type":"fixed","value":100}', 'Instalação aérea', 300),
    (v_lpu_id, jsonb_build_object('finalidade', inst_fin, 'condominio', false,
                                  'subterraneaAereo', 'Subterrâneo'),
     '{"type":"fixed","value":100}', 'Instalação subterrânea', 300);

  -- ── Suporte interno (prioridade 300) ─────────────────────────────────────────────────
  -- Planilha: interno 30, com venda de roteador atrelada também 30. "Suporte Fibra Retenção",
  -- "Suporte Interno (Configuração/Garantia)" e "Suporte Rádio" (todos 30) caem aqui.
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade) VALUES
    (v_lpu_id, jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Interno',
                                  'agregada', false),
     '{"type":"fixed","value":30}', 'Suporte Fibra Interno', 300),
    (v_lpu_id, jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Interno',
                                  'agregada', true),
     '{"type":"fixed","value":30}', 'Suporte Fibra Interno + venda de roteador atrelada', 300);

  -- ── Retirada (prioridade 100) ────────────────────────────────────────────────────────
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade) VALUES
    (v_lpu_id, '{"finalidade":"Retirada"}'::jsonb,
     '{"type":"fixed","value":20}', 'Retirada', 100);

  -- ── Classificações de cabeamento próprias (ADR-009 + 0035) ───────────────────────────
  -- A planilha confirma a base R$ 30 por dois caminhos: "ponto dentro da casa + segundo
  -- ponto" = 60 (30 + 1 ponto de 30) e "3 pontos (com adicionais)" = 90 (30 + 2 × 30). Por
  -- isso só as chaves-BASE entram — o motor soma os pontos adicionais sozinho (ADR-016), com
  -- o valor de R$ 30 desta LPU.
  -- As chaves NÃO declaradas aqui (cabeamento fibra aérea/subterrânea, segundo cliente,
  -- retirada condomínio) seguem pagando o valor do tenant: o motor faz merge, e um buraco
  -- viraria `no_rule_match`, que trava o fechamento. Cadastrar depois em /cabeamento se a
  -- Wave quiser valores próprios.
  DELETE FROM cabeamento_classifications WHERE lpu_id = v_lpu_id;
  INSERT INTO cabeamento_classifications
    (tenant_id, lpu_id, explicacao_original, explicacao_key, valor, observacao)
  VALUES
    (v_tenant_id, v_lpu_id, 'Cabeamento', 'Cabeamento', 30,
     'SEM AUXILIAR: cabeamento/segundo ponto (planilha 30/07/2026)'),
    (v_tenant_id, v_lpu_id, 'Cabeamento agregado', 'Cabeamento agregado', 30,
     'SEM AUXILIAR: cabeamento agregado a outra OS');

  -- ── Repasse de homologação próprio (ADR-015 + 0035) ──────────────────────────────────
  -- Planilha: "Instalação Fibra Homologação" = 30 (tabela padrão paga 35 para o mesmo
  -- valor de Unetvale). Os demais valores de Unetvale (dobrada, com ponto) não constam na
  -- planilha e seguem herdando os do tenant.
  DELETE FROM homologacao_classifications WHERE lpu_id = v_lpu_id;
  INSERT INTO homologacao_classifications
    (tenant_id, lpu_id, valor_unetvale, valor_repasse, observacao)
  VALUES
    (v_tenant_id, v_lpu_id, 64.46, 30, 'SEM AUXILIAR: homologação base (planilha 30/07/2026)');

  RAISE NOTICE 'LPU SEM AUXILIAR: % regras, % classificações de cabeamento, % de homologação.',
    (SELECT count(*) FROM lpu_rules WHERE lpu_id = v_lpu_id),
    (SELECT count(*) FROM cabeamento_classifications WHERE lpu_id = v_lpu_id),
    (SELECT count(*) FROM homologacao_classifications WHERE lpu_id = v_lpu_id);
END $$;

-- ── Conferência 1: a tabela padrão continua intocada ──────────────────────────────────────
-- Esperado: a LPU ativa com os três valores NULL (= comportamento histórico).
SELECT nome, ativa, ponto_adicional_valor, improdutiva_valor, feriado_acrescimo_pct
FROM lpus ORDER BY ativa DESC;

-- ── Conferência 2: as regras da SEM AUXILIAR, na ordem em que o motor as avalia ───────────
SELECT r.prioridade, r.description, r.payout ->> 'value' AS valor
FROM lpu_rules r
JOIN lpus l ON l.id = r.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR'
ORDER BY r.prioridade DESC, r.description;

-- ── Conferência 3: nenhum técnico foi atribuído automaticamente ───────────────────────────
-- Esperado: 0. A atribuição é ato do gestor, em /equipe/tecnicos/[id].
SELECT count(*) AS tecnicos_na_sem_auxiliar
FROM technicians t JOIN lpus l ON l.id = t.lpu_id
WHERE l.nome = 'LPU Wave — SEM AUXILIAR';
