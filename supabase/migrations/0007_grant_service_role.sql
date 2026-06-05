-- service_role bypassa RLS mas ainda precisa de GRANT de nível de tabela.
-- Sem estes GRANTs, operações via service role key (ex: globalTeardown de testes)
-- falham com "permission denied for table X" mesmo com bypass de RLS.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE technicians      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE uploads          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_orders   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_visits   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reasons          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lpus             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE lpu_rules        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payouts          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE monthly_closings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications    TO service_role;
GRANT SELECT ON TABLE audit_log            TO service_role;
GRANT SELECT ON TABLE service_visits_audit TO service_role;
GRANT SELECT ON TABLE lpu_rules_audit      TO service_role;
GRANT SELECT ON TABLE payouts_audit        TO service_role;
