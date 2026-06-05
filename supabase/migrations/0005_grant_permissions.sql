-- Tabelas criadas via migration SQL não recebem GRANT automático para
-- os roles anon/authenticated do PostgREST (ao contrário do Dashboard).
-- RLS (já definido em 0001) continua restringindo o que cada usuário pode
-- ver e fazer — estas grants apenas permitem que o PostgREST chegue até o RLS.

-- Tabelas operacionais: authenticated pode ler e escrever (RLS decide o escopo)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE technicians       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE uploads           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_orders    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_visits    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reasons           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lpus              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lpu_rules         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payouts           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE monthly_closings  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications     TO authenticated;

-- Tabelas de auditoria: apenas leitura (INSERT feito por triggers, não pelo app)
GRANT SELECT ON TABLE audit_log             TO authenticated;
GRANT SELECT ON TABLE service_visits_audit  TO authenticated;
GRANT SELECT ON TABLE lpu_rules_audit       TO authenticated;
GRANT SELECT ON TABLE payouts_audit         TO authenticated;

-- anon pode ler tenants para o middleware resolver slugs sem autenticação
GRANT SELECT ON TABLE tenants TO anon;

-- Funções RLS helpers: garantir EXECUTE para os roles do PostgREST
GRANT EXECUTE ON FUNCTION current_tenant_id()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_user_role()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION current_technician_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_tallpa_owner()       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION immutable_unaccent(text) TO authenticated, anon;
