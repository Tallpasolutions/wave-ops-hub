-- Suporte externo SEM troca de drop → paga como suporte simples (R$ 30 / R$ 45)
--
-- PROBLEMA (validado em produção, 30/07/2026):
--   As regras "Suporte Fibra Aéreo Externo" (R$ 120) e "Suporte Fibra Subterrâneo Externo"
--   (R$ 135) casam por tipoAtendimento + subterraneaAereo, e foram desenhadas para o suporte
--   COM troca de drop — cuja receita da Unetvale é ~R$ 206 (aéreo) / ~R$ 232 (subterrâneo).
--   Quando um suporte SIMPLES ("Suporte | 50 * 1.1 ...", receita R$ 64,46) vem da planilha
--   marcado como Externo e com o meio preenchido, ele casa a mesma regra e paga 4x o devido,
--   com margem NEGATIVA: R$ 120 pagos sobre R$ 64,46 recebidos.
--
--   3 visitas no histórico inteiro (nenhuma paga, todas pending_review sem override):
--     OS 574486  25/07/2026  Aéreo        R$ 120  (receita R$ 64,46)
--     OS 558063  19/05/2026  Aéreo        R$ 120  (receita R$ 64,46)
--     OS 559731  28/05/2026  Subterrâneo  R$ 135  (receita R$ 64,46)
--
-- SOLUÇÃO — threshold por receita da Unetvale, o padrão já documentado em
-- docs/domain/05-regras-especiais.md. Quatro regras novas com 5 condições cada
-- (prioridade 500), que vencem as de R$ 120/R$ 135 (prioridade 400) quando a receita
-- indica que NÃO houve troca de drop. Sem mudança de código: `valorRecebidoUnetvale` já é
-- uma condição válida do motor (aceita range) e o recálculo já converte o numeric para número.
--
-- FAIXA R$ 40–150 — calibrada contra os dados reais de todas as visitas de suporte externo:
--   dentro:  suporte simples (64,46) · suporte condomínio sem troca de fibra (64,46) ·
--            suporte retenção sem troca de drop (106,54) · troca de equipamento de local (109,87)
--   fora:    troca de drop aéreo (206,26 / 247,51 / 412,52) · subterrâneo (232,04 / 278,45)
--            improdutivas (15,98 e 0,00 — já resolvidas antes da LPU, ADR-016/calculate.ts)
--   O piso de R$ 40 preserva o comportamento atual das 19 visitas externas COM troca de drop
--   cuja receita veio R$ 0,00 — caso separado, não tocado aqui.
--
-- VALORES: espelham o par já vigente do suporte simples interno (R$ 30 sem venda atrelada,
--   R$ 45 com venda). As duas regras `agregada = true` são preventivas — hoje nenhuma visita
--   casa esse cenário; existem para que o mesmo bug não volte pela porta da venda atrelada.
--
-- Executar no SQL Editor. Idempotente. Depois: "Recalcular pendentes" em /pagamentos.

DO $$
DECLARE
  v_lpu_id  UUID;
  v_sup_fin JSONB;
  v_criadas INT := 0;
BEGIN
  SELECT l.id INTO v_lpu_id
  FROM lpus l
  JOIN tenants t ON t.id = l.tenant_id
  WHERE (t.slug = 'wave' OR t.dominio_custom ILIKE '%wave%')
    AND l.ativa = true
  LIMIT 1;

  IF v_lpu_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma LPU ativa encontrada para o tenant Wave.';
  END IF;

  -- Reaproveita a MESMA lista de finalidades das regras de suporte externo vigentes, para não
  -- divergir se ela mudar de novo (a Sprint 12 já anexou Troca de Equipamentos + de Local).
  SELECT conditions -> 'finalidade' INTO v_sup_fin
  FROM lpu_rules
  WHERE lpu_id = v_lpu_id
    AND conditions ->> 'tipoAtendimento' = 'Externo'
    AND conditions ->> 'subterraneaAereo' = 'Aéreo'
    AND conditions -> 'finalidade' @> '["Suporte Fibra"]'::jsonb
  LIMIT 1;

  IF v_sup_fin IS NULL THEN
    RAISE EXCEPTION 'Regra de Suporte Fibra Aéreo Externo não encontrada — verifique a LPU ativa.';
  END IF;

  RAISE NOTICE 'LPU ativa: % · finalidades de suporte: %', v_lpu_id, v_sup_fin;

  -- Aéreo / Subterrâneo × com / sem venda atrelada
  INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
  SELECT
    v_lpu_id,
    jsonb_build_object(
      'finalidade', v_sup_fin,
      'tipoAtendimento', 'Externo',
      'subterraneaAereo', novo.meio,
      'agregada', novo.agregada,
      'valorRecebidoUnetvale', jsonb_build_object('min', 40, 'max', 150)
    ),
    jsonb_build_object('type', 'fixed', 'value', novo.valor),
    novo.descricao,
    500
  FROM (VALUES
    ('Aéreo',       false, 30, 'Suporte Fibra Aéreo Externo sem troca de drop'),
    ('Subterrâneo', false, 30, 'Suporte Fibra Subterrâneo Externo sem troca de drop'),
    ('Aéreo',       true,  45, 'Suporte Fibra Aéreo Externo sem troca de drop + venda atrelada'),
    ('Subterrâneo', true,  45, 'Suporte Fibra Subterrâneo Externo sem troca de drop + venda atrelada')
  ) AS novo(meio, agregada, valor, descricao)
  WHERE NOT EXISTS (
    SELECT 1 FROM lpu_rules r
    WHERE r.lpu_id = v_lpu_id
      AND r.conditions ->> 'tipoAtendimento' = 'Externo'
      AND r.conditions ->> 'subterraneaAereo' = novo.meio
      AND (r.conditions -> 'agregada')::boolean IS NOT DISTINCT FROM novo.agregada
      AND r.conditions ? 'valorRecebidoUnetvale'
  );

  GET DIAGNOSTICS v_criadas = ROW_COUNT;
  RAISE NOTICE 'Regras de suporte externo sem troca de drop criadas: % (esperado 4 na 1a execução, 0 depois)', v_criadas;
END $$;

-- ── Conferência 1: as regras de suporte externo, na ordem em que o motor as avalia ──────────
SELECT r.prioridade, r.description, r.conditions -> 'valorRecebidoUnetvale' AS faixa_receita, r.payout
FROM lpu_rules r
JOIN lpus l ON l.id = r.lpu_id
JOIN tenants t ON t.id = l.tenant_id
WHERE (t.slug = 'wave' OR t.dominio_custom ILIKE '%wave%')
  AND l.ativa = true
  AND r.conditions ->> 'tipoAtendimento' = 'Externo'
  AND r.conditions -> 'finalidade' @> '["Suporte Fibra"]'::jsonb
ORDER BY r.prioridade DESC, r.description;

-- ── Conferência 2: as 3 OSs afetadas (rodar DEPOIS do "Recalcular pendentes") ───────────────
-- Esperado: 574486 e 558063 → R$ 30 · 559731 → R$ 30
SELECT v.os_num,
       v.data_execucao::date       AS data,
       v.subterraneo_aereo         AS meio,
       v.valor_recebido_unetvale   AS receita_unetvale,
       p.valor_calculado,
       p.status,
       lr.description              AS regra_aplicada
FROM service_visits v
JOIN payouts p ON p.visit_id = v.id
LEFT JOIN lpu_rules lr ON lr.id = p.lpu_rule_id
WHERE v.os_num IN (574486, 558063, 559731)
ORDER BY v.data_execucao;
