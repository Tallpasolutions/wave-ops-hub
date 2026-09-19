-- =============================================================================
-- Reversão de: supabase/migrations/0043_supervisor_sem_tecnico.sql (ADR-023)
--
-- ⚠️ SÓ FUNCIONA SE NENHUM SUPERVISOR TIVER technician_id NULO.
--    Depois que o gestor criar (ou desvincular) um supervisor sem técnico, esta reversão
--    passa a FALHAR — e é assim que tem que ser: reapertar o CHECK com linhas violando
--    deixaria a tabela sem constraint nenhuma.
--
--    Se precisar reverter mesmo assim, é preciso antes decidir o que fazer com esses
--    supervisores (vincular a um técnico, ou desativar). NÃO invente vínculo: apontar dois
--    usuários para o mesmo técnico é justamente o bug que a 0043 veio resolver.
--
-- Reversão de NÍVEL 1 (sem tocar no banco): reverter o deploy do código. O formulário volta
-- a exigir o vínculo, e o CHECK afrouxado simplesmente deixa de ser exercitado. Nenhum dado
-- se perde. É esta a reversão de incidente.
--
-- Sem bloco DO $$. Sem BEGIN/COMMIT. Aplicar statement a statement.
-- =============================================================================


-- ── 1. DÁ PARA REVERTER? — rodar ANTES ────────────────────────────────────────────────────
-- Esperado: 0 linhas. QUALQUER linha aqui impede a reversão: decida o vínculo dessas contas
-- antes de prosseguir.
SELECT id, email, role
FROM users
WHERE role = 'tenant_supervisor' AND technician_id IS NULL;


-- ── 2. Reapertar o CHECK para o predicado da 0009 ─────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check1;

ALTER TABLE users ADD CONSTRAINT users_check1 CHECK (
  (role IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NOT NULL)
  OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)
);


-- ── CONFERÊNCIA ───────────────────────────────────────────────────────────────────────────
-- Esperado: a definição volta a exigir technician_id para AMBOS os papéis.
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND conname = 'users_check1';
