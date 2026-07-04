-- =============================================================================
-- 0014 — Reconciliação: SECURITY DEFINER nos triggers de auditoria + GRANTs supervisor
--
-- CONTEXTO: estas correções já estão APLICADAS em produção (verificado 04/07/2026:
-- pg_proc.prosecdef = true nas três funções de auditoria; audit trails funcionando),
-- mas viviam numa branch nunca mergeada (`fix/audit-triggers-security-definer`, era da
-- Sprint 9). Por isso o histórico de migrations do repo pulava de 0009 para 0011 — um
-- buraco na fonte de verdade: um rebuild do banco do zero ficaria sem estas correções.
--
-- Esta migration traz o conteúdo órfão para a sequência oficial. Ela NÃO é um retrocesso
-- de numeração (não recria um "0010" fora de ordem, já que 0011–0013 rodaram depois em
-- produção) — é uma migration forward idempotente. Rodar em produção é um NO-OP seguro:
-- CREATE OR REPLACE FUNCTION e GRANT são idempotentes.
--
-- Nota de imutabilidade: os GRANTs de supervisor_technicians pertenciam originalmente a
-- uma edição da 0009 (já aplicada). Migration aplicada é imutável — por isso os GRANTs
-- entram aqui, não editando a 0009.
-- =============================================================================

-- ── 1. Triggers de auditoria com SECURITY DEFINER (origem: 0010 órfão) ──────────
-- Sem SECURITY DEFINER, as funções rodam como INVOKER (authenticated, que só tem
-- GRANT SELECT nas tabelas de auditoria) → o INSERT falha com "permission denied" e
-- faz rollback do UPDATE original. Com SECURITY DEFINER rodam como owner (postgres).

CREATE OR REPLACE FUNCTION trg_audit_visits()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO service_visits_audit(visit_id, upload_id, changed_by, before, after)
    VALUES (NEW.id, NEW.upload_id, NULL, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_audit_lpu_rules()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO lpu_rules_audit(rule_id, changed_by, before, after)
    VALUES (NEW.id, NULL, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_audit_payouts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO payouts_audit(payout_id, changed_by, before, after)
    VALUES (NEW.id, NEW.override_by, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. GRANTs de supervisor_technicians (origem: edição da 0009) ────────────────
-- Mesmo padrão de GRANTs das migrations 0005 e 0007.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supervisor_technicians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supervisor_technicians TO service_role;

-- ── Verificação (esperado: prosecdef = true nas três) ───────────────────────────
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('trg_audit_visits', 'trg_audit_lpu_rules', 'trg_audit_payouts')
ORDER BY proname;
