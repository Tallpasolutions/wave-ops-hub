-- Regras extras na LPU ativa da Wave — Sprint 12, Fase C (parte fixa)
--
-- Decisão da Wave (03/07/2026):
--   - Venda Produto Externo → NÃO é repassada ao técnico (payout R$ 0)
--   - Troca de Equipamentos e Troca de Equipamentos de Local → pagas com valor de Suporte
--     Fibra (mesmos atributos: interno/externo, aéreo/subterrâneo, com/sem venda)
--
-- As finalidades de infraestrutura (Projeto Infra etc.) NÃO entram aqui — são tratadas pela
-- migration 0013 (ADR-008), que as exclui do escopo. O grupo Cabeamento fica para o futuro
-- ADR de match por explicação de valor.
--
-- Executar no SQL Editor. Idempotente (guardas NOT EXISTS / @>). Depois: "Recalcular
-- pendentes" em /pagamentos.

DO $$
DECLARE
  v_lpu_id UUID;
  v_updated INT;
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

  -- 1. Troca de Equipamentos (+ de Local) → anexadas às finalidades das regras de Suporte Fibra.
  --    Só as regras cujo finalidade contém "Suporte Fibra"; guarda de idempotência evita
  --    anexar duas vezes.
  UPDATE lpu_rules r
  SET conditions = jsonb_set(
        r.conditions,
        '{finalidade}',
        (r.conditions -> 'finalidade')
          || '["Troca de Equipamentos","Troca de Equipamentos de Local"]'::jsonb
      )
  WHERE r.lpu_id = v_lpu_id
    AND r.conditions -> 'finalidade' @> '["Suporte Fibra"]'::jsonb
    AND NOT (r.conditions -> 'finalidade' @> '["Troca de Equipamentos"]'::jsonb);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Regras de Suporte Fibra estendidas com Troca de Equipamentos: %', v_updated;

  -- 2. Venda Produto Externo → payout R$ 0 (1 condição → prioridade 100)
  IF NOT EXISTS (
    SELECT 1 FROM lpu_rules
    WHERE lpu_id = v_lpu_id
      AND conditions -> 'finalidade' @> '["Venda Produto Externo"]'::jsonb
  ) THEN
    INSERT INTO lpu_rules (lpu_id, conditions, payout, description, prioridade)
    VALUES (
      v_lpu_id,
      '{"finalidade":["Venda Produto Externo"]}'::jsonb,
      '{"type":"fixed","value":0}'::jsonb,
      'Venda Produto Externo (não repassada ao técnico)',
      100
    );
    RAISE NOTICE 'Regra Venda Produto Externo (R$ 0) criada.';
  ELSE
    RAISE NOTICE 'Regra Venda Produto Externo já existe — nada a fazer.';
  END IF;
END $$;

-- Conferência: as regras afetadas
SELECT description, prioridade, conditions -> 'finalidade' AS finalidades, payout
FROM lpu_rules r
JOIN lpus l ON l.id = r.lpu_id
JOIN tenants t ON t.id = l.tenant_id
WHERE (t.slug = 'wave' OR t.dominio_custom ILIKE '%wave%')
  AND l.ativa = true
  AND (r.conditions -> 'finalidade' @> '["Troca de Equipamentos"]'::jsonb
       OR r.conditions -> 'finalidade' @> '["Venda Produto Externo"]'::jsonb)
ORDER BY prioridade DESC, description;
