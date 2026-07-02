-- =============================================================================
-- 0011 — Corrige trigger de consolidação em payouts
--
-- Bug: trg_payout_consolidar_so usava a mesma função trg_visit_consolidar()
-- que foi escrita para service_visits (que tem os_num diretamente). Quando
-- chamada a partir de payouts, tenta acessar NEW.os_num — coluna que não
-- existe em payouts. Resultado: erro em todo INSERT/UPDATE/DELETE em payouts
-- → rollback → tabela payouts fica sempre vazia.
--
-- Correção: criar função dedicada trg_payout_consolidar() que busca
-- tenant_id e os_num via join em service_visits pelo visit_id.
-- SECURITY DEFINER garante acesso independente do usuário que disparou
-- a operação.
--
-- Aplicar manualmente via Supabase SQL Editor antes do deploy.
-- =============================================================================

-- 1. Função correta para o trigger de payouts
CREATE OR REPLACE FUNCTION trg_payout_consolidar()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id UUID;
  v_os_num    BIGINT;
BEGIN
  SELECT sv.tenant_id, sv.os_num
    INTO v_tenant_id, v_os_num
    FROM service_visits sv
   WHERE sv.id = COALESCE(NEW.visit_id, OLD.visit_id);

  IF v_tenant_id IS NOT NULL THEN
    PERFORM consolidar_service_order(v_tenant_id, v_os_num);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Substituir o trigger defeituoso
DROP TRIGGER IF EXISTS trg_payout_consolidar_so ON payouts;
CREATE TRIGGER trg_payout_consolidar_so
  AFTER INSERT OR UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION trg_payout_consolidar();

-- 3. SECURITY DEFINER em consolidar_service_order para garantir acesso
--    correto independente do contexto de chamada
CREATE OR REPLACE FUNCTION consolidar_service_order(p_tenant_id UUID, p_os_num BIGINT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_visitas       INT;
  v_data_resolucao      DATE;
  v_tentativas          INT;
  v_receita             NUMERIC;
  v_custo               NUMERIC;
  v_status              TEXT;
  v_finalidade          TEXT;
  v_cidade              TEXT;
  v_condo               BOOLEAN;
  v_cat1                TEXT;
  v_cat2                TEXT;
  v_cat3                TEXT;
BEGIN
  -- Calcula a partir das visitas
  SELECT
    COUNT(*),
    MIN(data_execucao) FILTER (WHERE sucesso ILIKE 'Sim%'),
    (SELECT COUNT(*) FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
         AND v2.data_execucao <= MIN(service_visits.data_execucao) FILTER (WHERE service_visits.sucesso ILIKE 'Sim%')),
    SUM(COALESCE(valor_recebido_unetvale, 0)),
    -- snapshot dos campos descritivos a partir da visita mais recente
    (SELECT finalidade FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1),
    (SELECT cidade FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1),
    (SELECT condominio FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1),
    (SELECT cat1 FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1),
    (SELECT cat2 FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1),
    (SELECT cat3 FROM service_visits v2
       WHERE v2.tenant_id = p_tenant_id AND v2.os_num = p_os_num
       ORDER BY data_execucao DESC LIMIT 1)
  INTO
    v_total_visitas, v_data_resolucao, v_tentativas, v_receita,
    v_finalidade, v_cidade, v_condo, v_cat1, v_cat2, v_cat3
  FROM service_visits
  WHERE tenant_id = p_tenant_id AND os_num = p_os_num;

  -- Custo total a partir de payouts
  SELECT COALESCE(SUM(COALESCE(valor_override, valor_calculado, 0)), 0)
  INTO v_custo
  FROM payouts p
  JOIN service_visits v ON v.id = p.visit_id
  WHERE v.tenant_id = p_tenant_id AND v.os_num = p_os_num;

  -- Status consolidado
  IF v_total_visitas = 0 THEN
    DELETE FROM service_orders WHERE tenant_id = p_tenant_id AND os_num = p_os_num;
    RETURN;
  ELSIF v_data_resolucao IS NOT NULL THEN
    v_status := 'resolvida';
  ELSE
    v_status := 'em_andamento';
  END IF;

  -- Upsert
  INSERT INTO service_orders (
    tenant_id, os_num, total_visitas, data_resolucao, tentativas_ate_sucesso,
    status_consolidado, custo_total, receita_total,
    finalidade, cidade, condominio, cat1, cat2, cat3
  )
  VALUES (
    p_tenant_id, p_os_num, v_total_visitas, v_data_resolucao, v_tentativas,
    v_status, v_custo, v_receita,
    v_finalidade, v_cidade, v_condo, v_cat1, v_cat2, v_cat3
  )
  ON CONFLICT (tenant_id, os_num) DO UPDATE SET
    total_visitas           = EXCLUDED.total_visitas,
    data_resolucao          = EXCLUDED.data_resolucao,
    tentativas_ate_sucesso  = EXCLUDED.tentativas_ate_sucesso,
    status_consolidado      = EXCLUDED.status_consolidado,
    custo_total             = EXCLUDED.custo_total,
    receita_total           = EXCLUDED.receita_total,
    finalidade              = EXCLUDED.finalidade,
    cidade                  = EXCLUDED.cidade,
    condominio              = EXCLUDED.condominio,
    cat1                    = EXCLUDED.cat1,
    cat2                    = EXCLUDED.cat2,
    cat3                    = EXCLUDED.cat3,
    updated_at              = now();
END;
$$;
