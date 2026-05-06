-- =============================================================================
-- Wave Ops Hub — Seed inicial
-- =============================================================================
-- Dados mínimos para colocar o sistema em pé:
--   - Tenant Wave Telecom criado
--   - Usuário Tallpa owner criado (Jhoni)
--   - Usuário Wave owner placeholder
--
-- ⚠️ Em produção, alguns destes inserts ficam comentados/ajustados.
--    Senhas reais são definidas via Supabase Auth, NÃO aqui.
-- =============================================================================

-- Tenant Wave Telecom
INSERT INTO tenants (id, slug, nome, brand_path, plano, ativo, config)
VALUES (
  'a1b2c3d4-0001-0001-0001-000000000001',
  'wave',
  'Wave Telecom',
  'wave',
  'starter',
  true,
  '{
    "show_money_on_technician_panel": true,
    "auto_create_reasons": true
  }'::jsonb
);

-- ⚠️ Os usuários abaixo precisam ser criados primeiro via Supabase Auth API
-- (signup ou admin createUser), depois sincronizados aqui via trigger.
--
-- O fluxo correto é:
--   1. via Supabase Dashboard, criar usuário em Authentication > Users com email
--   2. esse user vira auth.users
--   3. trigger sincroniza pra public.users com role e tenant_id corretos
--
-- Este seed apenas demonstra a estrutura esperada e serve como referência.
--
-- Para dev, crie um usuário Tallpa owner manualmente no Supabase Dashboard:
--   - Email: jhoni@tallpa.com.br
--   - Password: (sua escolha)
--   - Após criação, executar:

-- INSERT INTO users (id, tenant_id, email, nome_completo, role)
-- VALUES (
--   '<uuid_de_auth.users>',
--   NULL,
--   'jhoni@tallpa.com.br',
--   'Jhoni Cleyton',
--   'tallpa_owner'
-- );

-- E para um Wave owner de teste:
-- INSERT INTO users (id, tenant_id, email, nome_completo, role)
-- VALUES (
--   '<uuid_de_auth.users>',
--   'a1b2c3d4-0001-0001-0001-000000000001',
--   'gestor@wavetelecom.com.br',
--   'Gestor Wave',
--   'tenant_owner'
-- );

-- =============================================================================
-- Motivos de exemplo (opcional, fácil de pré-popular)
-- =============================================================================

-- Não preencher aqui — deixar a auto-criação na ingestão fazer o trabalho.
-- Cliente classifica conforme aparecem.

-- =============================================================================
-- LPU exemplo (NÃO inserir em prod — apenas referência)
-- =============================================================================

-- Em produção, gestor cria via UI. Este bloco é apenas referência de estrutura.
/*
INSERT INTO lpus (id, tenant_id, nome, vigencia_inicio, ativa)
VALUES (
  'b1c2d3e4-0001-0001-0001-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'LPU Wave 2026',
  '2026-01-01',
  true
);

INSERT INTO lpu_rules (lpu_id, prioridade, conditions, payout, description)
VALUES
  -- Regra exemplo: Suporte Fibra externo com sucesso = R$ 80
  (
    'b1c2d3e4-0001-0001-0001-000000000001',
    300,
    '{"finalidade": "Suporte Fibra", "tipo_atendimento": "Externo", "sucesso": "Sim"}'::jsonb,
    '{"type": "fixed", "value": 80.00}'::jsonb,
    'Suporte Fibra Externo - Sucesso'
  ),
  -- Regra exemplo: Instalação fórmula com base + drop
  (
    'b1c2d3e4-0001-0001-0001-000000000001',
    400,
    '{"finalidade": "Instalação", "tipo_atendimento": "Externo", "sucesso": "Sim"}'::jsonb,
    '{"type": "formula", "base": 50.00, "additional": {"field": "drop_usado", "rate_per_unit": 0.30}}'::jsonb,
    'Instalação Externa - Sucesso'
  );
*/
