-- =============================================================================
-- 0043 — Supervisor deixa de ser obrigatoriamente um técnico (ADR-023 · Sprint 19)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Sem BEGIN/COMMIT. Idempotente.
-- Aplicar colando no SQL Editor do Supabase.
--
-- ⚠️ APLICADA MANUALMENTE EM 2026-09-19 por Jhoni Cleyton, antes deste arquivo existir.
--    O conteúdo abaixo reproduz exatamente o que foi executado, com IF EXISTS acrescentado
--    para reexecução segura. Rodar de novo é inofensivo.
--
-- ── PROBLEMA ──────────────────────────────────────────────────────────────────────────────
-- O CHECK da 0009 obrigava `tenant_supervisor` a ter technician_id NOT NULL — ou seja, todo
-- supervisor tinha que SER um técnico cadastrado. Mas nem todo supervisor executa visitas;
-- muitos só acompanham equipe.
--
-- Na prática isso forçava o gestor a escolher um técnico qualquer só para o formulário
-- passar. Foi o que aconteceu no cadastro de teste: dois usuários (tecnico@ e supervisor@)
-- ficaram apontando para o MESMO registro de `technicians`.
--
-- E isso quebra em silêncio: `notifyTechnician` (src/lib/notifications/notify.ts) resolve o
-- usuário com `.eq('technician_id', ...).maybeSingle()`. Com duas linhas, maybeSingle()
-- retorna erro, a função sai sem notificar e SEM AVISAR NINGUÉM. É exatamente o modo de
-- falha previsto no ADR-022, que por isso criou `notifySupervisorUser` por users.id.
--
-- ── DECISÃO (Jhoni Cleyton, 2026-09-19 · ADR-023) ─────────────────────────────────────────
-- `users.technician_id` passa a ser OPCIONAL para `tenant_supervisor`.
--
-- São duas relações diferentes, que o formulário misturava:
--   users.technician_id     → "este supervisor É o técnico Fulano"      (agora opcional)
--   supervisor_technicians  → "é RESPONSÁVEL POR estes técnicos"        (inalterada)
--
-- ── O QUE ESTE ARQUIVO NÃO FAZ ────────────────────────────────────────────────────────────
-- Só AFROUXA o CHECK: toda linha existente continua válida, nada é apagado nem migrado.
-- `tenant_technician` segue obrigado a ter technician_id. Os demais papéis seguem obrigados
-- a NÃO ter. Não toca supervisor_technicians, nenhuma política RLS, o auth hook, os 5 papéis,
-- nem qualquer outra tabela.
--
-- ── RISCO ─────────────────────────────────────────────────────────────────────────────────
-- DROP + ADD numa tabela em produção: existe um instante sem a constraint, e se o ADD falhar
-- (alguma linha violando o novo predicado) a tabela fica SEM constraint. Por isso a
-- Conferência 0 roda ANTES: se ela voltar qualquer linha, NÃO aplique.
--
-- ── REVERSÃO ──────────────────────────────────────────────────────────────────────────────
-- Ver supabase/rollback/0043_supervisor_sem_tecnico.down.sql.
-- Só é possível enquanto nenhum supervisor tiver technician_id nulo.
-- =============================================================================


-- ── CONFERÊNCIA 0 — rodar ANTES de aplicar ────────────────────────────────────────────────
-- Esperado: 0 linhas. Qualquer linha aqui viola o CHECK novo e faria o ADD falhar.
SELECT id, email, role, technician_id
FROM users
WHERE NOT (
  (role = 'tenant_technician' AND technician_id IS NOT NULL)
  OR (role = 'tenant_supervisor')
  OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)
);


-- ── 1. Afrouxar o CHECK ───────────────────────────────────────────────────────────────────
-- `users_check1` é nome auto-gerado pelo Postgres na 0001 (ver cabeçalho da 0009).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check1;

ALTER TABLE users ADD CONSTRAINT users_check1 CHECK (
  (role = 'tenant_technician' AND technician_id IS NOT NULL)
  OR (role = 'tenant_supervisor')
  OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)
);


-- =============================================================================
-- CONFERÊNCIAS — rodar depois de aplicar
-- =============================================================================

-- ── 1. A constraint existe e tem o predicado novo ─────────────────────────────────────────
-- Esperado: 1 linha, e a definição deve conter "role = 'tenant_supervisor'" SEM exigir
-- technician_id junto.
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND conname = 'users_check1';

-- ── 2. As OUTRAS constraints de users continuam intactas ──────────────────────────────────
-- Esperado: users_role_check (5 papéis) e users_check (consistência de tenant_id) presentes.
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND contype = 'c'
ORDER BY conname;

-- ── 3. Nenhuma linha ficou inválida ───────────────────────────────────────────────────────
-- Esperado: 0 linhas.
SELECT id, email, role, technician_id
FROM users
WHERE NOT (
  (role = 'tenant_technician' AND technician_id IS NOT NULL)
  OR (role = 'tenant_supervisor')
  OR (role NOT IN ('tenant_technician', 'tenant_supervisor') AND technician_id IS NULL)
);

-- ── 4. Quem são os supervisores e como estão hoje ─────────────────────────────────────────
-- Referência para o gestor decidir quais devem perder o vínculo.
-- `compartilha_tecnico = true` marca o caso problemático: dois usuários no mesmo técnico,
-- que faz notifyTechnician sumir em silêncio.
SELECT u.email, u.role, u.technician_id, t.nome_completo AS tecnico_vinculado,
       (SELECT count(*) FROM users u2
        WHERE u2.technician_id = u.technician_id AND u2.id <> u.id) > 0 AS compartilha_tecnico
FROM users u
LEFT JOIN technicians t ON t.id = u.technician_id
WHERE u.role = 'tenant_supervisor'
ORDER BY u.email;
