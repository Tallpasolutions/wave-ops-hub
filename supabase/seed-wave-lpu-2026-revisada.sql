-- ============================================================
-- Seed: LPU Wave 2026 — Revisada
-- Executar no Supabase SQL Editor (não é migration de schema)
-- Gerado em: 2026-07-02
--
-- APÓS EXECUTAR:
-- 1. Abrir /lpu na plataforma e ativar a nova LPU
-- 2. Clicar em "Recalcular pendentes" em /pagamentos
--
-- REGRAS INCLUÍDAS (12 regras AUTO + SEMI):
--   - Instalação aérea / subterrânea (sem condomínio)
--   - Instalação condomínio (aéreo externo / subterrâneo externo / genérica)
--   - Retirada
--   - Suporte Fibra aéreo externo (com e sem venda atrelada)
--   - Suporte Fibra subterrâneo externo (com e sem venda atrelada)
--   - Suporte Fibra interno (com e sem venda atrelada)
--
-- REGRAS NÃO INCLUÍDAS (aguardando estrutura de dados):
--   - Pontos adicionais (identificados por "Explicação do valor")
--   - Cordoalha (identificada por "Explicação do valor")
--   - Homologação / Retenção (identificadas por "Explicação do valor")
--   - +15% feriados (decisão arquitetural pendente)
--   - Venda Produto Externo / Troca Equipamentos (confirmar finalidade exata)
-- ============================================================

DO $$
DECLARE
  v_tenant_id  UUID;
  v_lpu_id     UUID;
  inst_fin     JSONB := '["Instalação - Fibra - PF", "Instalação - Fibra - PJ", "Mudança Endereço Fibra"]';
  sup_fin      JSONB := '["Suporte Fibra", "Suporte", "Suporte Condomínio"]';
BEGIN

  -- ── Identificar tenant Wave ──────────────────────────────
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE dominio_custom ILIKE '%wave%'
     OR slug = 'wave'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant Wave não encontrado. Verifique dominio_custom ou slug na tabela tenants.';
  END IF;

  RAISE NOTICE 'Tenant Wave: %', v_tenant_id;

  -- ── Criar LPU (inativa — gerente ativa pela UI) ─────────
  IF EXISTS (
    SELECT 1 FROM lpus
    WHERE tenant_id = v_tenant_id
      AND nome = 'LPU Wave 2026 — Revisada'
  ) THEN
    RAISE EXCEPTION 'LPU "LPU Wave 2026 — Revisada" já existe para este tenant. Delete-a primeiro se quiser recriar.';
  END IF;

  INSERT INTO lpus (tenant_id, nome, vigencia_inicio, ativa)
  VALUES (v_tenant_id, 'LPU Wave 2026 — Revisada', '2026-06-01', false)
  RETURNING id INTO v_lpu_id;

  RAISE NOTICE 'LPU criada (inativa): %', v_lpu_id;

  -- ============================================================
  -- INSTALAÇÃO SEM CONDOMÍNIO
  -- ============================================================

  -- Instalação Aérea → R$120  (3 condições → prio 300)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', inst_fin, 'subterraneaAereo', 'Aéreo', 'condominio', false),
    '{"type":"fixed","value":120}',
    'Instalação Aérea (residencial / PJ)',
    300
  );

  -- Instalação Subterrânea → R$135  (3 condições → prio 300)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', inst_fin, 'subterraneaAereo', 'Subterrâneo', 'condominio', false),
    '{"type":"fixed","value":135}',
    'Instalação Subterrânea (residencial / PJ)',
    300
  );

  -- ============================================================
  -- INSTALAÇÃO EM CONDOMÍNIO
  -- ============================================================

  -- Condomínio Aéreo Externo → R$190  (4 condições → prio 400, supera regra genérica)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', inst_fin, 'condominio', true, 'subterraneaAereo', 'Aéreo', 'tipoAtendimento', 'Externo'),
    '{"type":"fixed","value":190}',
    'Instalação Condomínio Aéreo Externo',
    400
  );

  -- Condomínio Subterrâneo Externo → R$70  (4 condições → prio 400)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', inst_fin, 'condominio', true, 'subterraneaAereo', 'Subterrâneo', 'tipoAtendimento', 'Externo'),
    '{"type":"fixed","value":70}',
    'Instalação Condomínio Subterrâneo Externo',
    400
  );

  -- Condomínio genérica (interno ou sem info de rede) → R$70  (2 condições → prio 200)
  -- Captura qualquer instalação em condomínio não coberta pelas regras acima
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', inst_fin, 'condominio', true),
    '{"type":"fixed","value":70}',
    'Instalação Condomínio (genérica)',
    200
  );

  -- ============================================================
  -- RETIRADA
  -- ============================================================

  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    '{"finalidade":"Retirada"}',
    '{"type":"fixed","value":20}',
    'Retirada',
    100
  );

  -- ============================================================
  -- SUPORTE FIBRA — AÉREO EXTERNO
  -- ============================================================

  -- Sem venda atrelada → R$120  (4 condições → prio 400)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'subterraneaAereo', 'Aéreo', 'tipoAtendimento', 'Externo', 'agregada', false),
    '{"type":"fixed","value":120}',
    'Suporte Fibra Aéreo Externo',
    400
  );

  -- Com venda atrelada → R$130  (4 condições → prio 400)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'subterraneaAereo', 'Aéreo', 'tipoAtendimento', 'Externo', 'agregada', true),
    '{"type":"fixed","value":130}',
    'Suporte Fibra Aéreo Externo + venda atrelada',
    400
  );

  -- ============================================================
  -- SUPORTE FIBRA — SUBTERRÂNEO EXTERNO
  -- ============================================================

  -- Sem venda atrelada → R$135  (4 condições → prio 400)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'subterraneaAereo', 'Subterrâneo', 'tipoAtendimento', 'Externo', 'agregada', false),
    '{"type":"fixed","value":135}',
    'Suporte Fibra Subterrâneo Externo',
    400
  );

  -- Com venda atrelada → R$135  (4 condições → prio 400)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'subterraneaAereo', 'Subterrâneo', 'tipoAtendimento', 'Externo', 'agregada', true),
    '{"type":"fixed","value":135}',
    'Suporte Fibra Subterrâneo Externo + venda atrelada',
    400
  );

  -- ============================================================
  -- SUPORTE FIBRA — INTERNO
  -- ============================================================

  -- Sem venda atrelada → R$30  (3 condições → prio 300)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Interno', 'agregada', false),
    '{"type":"fixed","value":30}',
    'Suporte Fibra Interno',
    300
  );

  -- Com venda atrelada → R$45  (3 condições → prio 300)
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  VALUES (
    v_lpu_id,
    jsonb_build_object('finalidade', sup_fin, 'tipoAtendimento', 'Interno', 'agregada', true),
    '{"type":"fixed","value":45}',
    'Suporte Fibra Interno + venda atrelada',
    300
  );

  RAISE NOTICE '✓ 12 regras inseridas. LPU ID: %', v_lpu_id;
  RAISE NOTICE 'Próximo passo: ativar em /lpu e recalcular pendentes em /pagamentos.';

END $$;
