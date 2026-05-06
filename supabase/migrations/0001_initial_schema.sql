-- =============================================================================
-- Wave Ops Hub — Migration 0001: Schema inicial completo
-- =============================================================================
-- Este arquivo cria todo o schema base do sistema. É a fundação sobre a qual
-- todas as próximas migrations evoluem incrementalmente.
--
-- IMPORTANTE: este arquivo é referência. Em produção, as migrations serão
-- divididas por sprint conforme a evolução do projeto. Veja docs/sprints/
-- para o plano de execução.
-- =============================================================================

-- Extensões necessárias
-- No Supabase, extensões instalam no schema "extensions" por padrão.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- =============================================================================
-- 1. TENANTS — entidades de plataforma
-- =============================================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  dominio_custom TEXT UNIQUE,
  brand_path TEXT NOT NULL,
  plano TEXT NOT NULL DEFAULT 'starter',
  config JSONB NOT NULL DEFAULT '{
    "show_money_on_technician_panel": true,
    "auto_create_reasons": true
  }'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 32)
);

CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE ativo = true;
CREATE INDEX idx_tenants_dominio_custom ON tenants(dominio_custom) WHERE dominio_custom IS NOT NULL;

-- =============================================================================
-- 2. USERS — usuários do sistema
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tallpa_owner', 'tenant_owner', 'tenant_manager', 'tenant_technician')),
  technician_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (role = 'tallpa_owner' AND tenant_id IS NULL) OR
    (role IN ('tenant_owner', 'tenant_manager', 'tenant_technician') AND tenant_id IS NOT NULL)
  ),
  CHECK (
    (role = 'tenant_technician' AND technician_id IS NOT NULL) OR
    (role != 'tenant_technician' AND technician_id IS NULL)
  )
);

CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE ativo = true;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_technician ON users(technician_id) WHERE technician_id IS NOT NULL;

-- =============================================================================
-- 3. TECHNICIANS — técnicos de campo
-- =============================================================================

CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf TEXT,
  celular TEXT,
  codigo_unetvale TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_admissao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, cpf),
  UNIQUE (tenant_id, codigo_unetvale)
);

-- FK circular entre users.technician_id e technicians.id agora que ambas existem
ALTER TABLE users ADD CONSTRAINT fk_users_technician
  FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL;

-- Wrapper IMMUTABLE de unaccent — necessário porque unaccent() é STABLE por padrão
-- e Postgres exige funções IMMUTABLE em expressões de índice. O dicionário unaccent
-- é tratado como estável o suficiente para índices na prática.
-- A função é qualificada com o schema "extensions" porque é onde o Supabase
-- instala extensões por padrão.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text AS $$
  SELECT extensions.unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE INDEX idx_technicians_tenant ON technicians(tenant_id) WHERE ativo = true;
CREATE INDEX idx_technicians_nome_normalizado
  ON technicians(tenant_id, lower(immutable_unaccent(nome_completo)));

-- =============================================================================
-- 4. UPLOADS — registros de submissões de planilha
-- =============================================================================

CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'duplicate')),
  periodo_inicio DATE,
  periodo_fim DATE,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  inseridas INTEGER NOT NULL DEFAULT 0,
  atualizadas INTEGER NOT NULL DEFAULT 0,
  ignoradas INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  error_log JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, file_hash)
);

CREATE INDEX idx_uploads_tenant_status ON uploads(tenant_id, status);
CREATE INDEX idx_uploads_tenant_uploaded ON uploads(tenant_id, uploaded_at DESC);

-- =============================================================================
-- 5. SERVICE_ORDERS — ordens de serviço (consolidado)
-- =============================================================================

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  os_num BIGINT NOT NULL,
  inicio_sistema TIMESTAMPTZ,
  cliente_usuario TEXT,
  contrato TEXT,
  finalidade TEXT,
  cidade TEXT,
  condominio BOOLEAN DEFAULT false,
  cat1 TEXT,
  cat2 TEXT,
  cat3 TEXT,
  status_consolidado TEXT NOT NULL DEFAULT 'em_andamento'
    CHECK (status_consolidado IN ('aberta', 'em_andamento', 'resolvida', 'cancelada')),
  data_resolucao TIMESTAMPTZ,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  tentativas_ate_sucesso INTEGER,
  custo_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  receita_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, os_num)
);

CREATE INDEX idx_so_tenant_status ON service_orders(tenant_id, status_consolidado);
CREATE INDEX idx_so_tenant_data ON service_orders(tenant_id, data_resolucao DESC NULLS LAST);
CREATE INDEX idx_so_tenant_finalidade ON service_orders(tenant_id, finalidade);
CREATE INDEX idx_so_tenant_cidade ON service_orders(tenant_id, cidade);

-- =============================================================================
-- 6. REASONS — motivos de não-conclusão de visita
-- =============================================================================

CREATE TABLE reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  motivo_original TEXT NOT NULL,
  motivo_normalizado TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'falha_tecnico', 'falha_cliente', 'forca_maior', 'falha_sistema', 'pendente_classificacao'
  )),
  paga_improdutiva BOOLEAN NOT NULL DEFAULT false,
  valor_improdutiva NUMERIC(10, 2),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, motivo_original)
);

CREATE INDEX idx_reasons_tenant_categoria ON reasons(tenant_id, categoria);
CREATE INDEX idx_reasons_pendentes ON reasons(tenant_id) WHERE categoria = 'pendente_classificacao';

-- =============================================================================
-- 7. SERVICE_VISITS — visitas (uma linha da planilha = uma visita)
-- =============================================================================

CREATE TABLE service_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  os_num BIGINT NOT NULL,
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  data_execucao TIMESTAMPTZ NOT NULL,
  tecnico_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  tecnico_raw TEXT NOT NULL,
  reason_id UUID REFERENCES reasons(id) ON DELETE SET NULL,
  finalidade TEXT,
  tipo_atendimento TEXT CHECK (tipo_atendimento IN ('Externo', 'Interno')),
  cidade TEXT,
  sucesso TEXT NOT NULL,
  improdutiva BOOLEAN DEFAULT false,
  valor_recebido_unetvale NUMERIC(10, 2),
  drop_usado NUMERIC(10, 2),
  faixa_drop TEXT,
  conectores_usados INTEGER,
  condominio BOOLEAN DEFAULT false,
  subterraneo_aereo TEXT,
  garantia BOOLEAN DEFAULT false,
  validada BOOLEAN DEFAULT false,
  agregada BOOLEAN DEFAULT false,
  rejeitada BOOLEAN DEFAULT false,
  agendada BOOLEAN DEFAULT false,
  trocado_drop BOOLEAN DEFAULT false,
  motivo_troca TEXT,
  outras_fibras BOOLEAN DEFAULT false,
  quantas_fibras INTEGER,
  categoria_interna TEXT,
  cat1 TEXT,
  cat2 TEXT,
  cat3 TEXT,
  explicacao_valor TEXT,
  observacoes TEXT,
  num_tecnicos INTEGER,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)
);

-- Para casos onde tecnico_id IS NULL, garantir unicidade pelo nome bruto
CREATE UNIQUE INDEX idx_visit_unique_no_match
  ON service_visits(tenant_id, os_num, data_execucao, tecnico_raw)
  WHERE tecnico_id IS NULL;

CREATE INDEX idx_visits_tenant_data ON service_visits(tenant_id, data_execucao DESC);
CREATE INDEX idx_visits_tenant_tecnico ON service_visits(tenant_id, tecnico_id) WHERE tecnico_id IS NOT NULL;
CREATE INDEX idx_visits_tenant_os ON service_visits(tenant_id, os_num);
CREATE INDEX idx_visits_tenant_sucesso ON service_visits(tenant_id, sucesso);
CREATE INDEX idx_visits_pendentes_vinculo ON service_visits(tenant_id) WHERE tecnico_id IS NULL;

-- =============================================================================
-- 8. LPUS — listas de preço unitário
-- =============================================================================

CREATE TABLE lpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  ativa BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE INDEX idx_lpus_tenant_ativa ON lpus(tenant_id) WHERE ativa = true;
CREATE INDEX idx_lpus_tenant_vigencia ON lpus(tenant_id, vigencia_inicio DESC);

-- Apenas uma LPU ativa por tenant — enforced via trigger (evita race condition em INSERT)
CREATE OR REPLACE FUNCTION enforce_single_active_lpu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ativa = true THEN
    IF EXISTS (
      SELECT 1 FROM lpus
      WHERE tenant_id = NEW.tenant_id
        AND ativa = true
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe uma LPU ativa para este tenant. Desative-a primeiro.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_active_lpu
  BEFORE INSERT OR UPDATE ON lpus
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_lpu();

-- =============================================================================
-- 9. LPU_RULES — regras individuais de uma LPU
-- =============================================================================

CREATE TABLE lpu_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lpu_id UUID NOT NULL REFERENCES lpus(id) ON DELETE CASCADE,
  prioridade INTEGER NOT NULL,
  conditions JSONB NOT NULL,
  payout JSONB NOT NULL,
  description TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lpu_rules_lpu_prioridade ON lpu_rules(lpu_id, prioridade DESC) WHERE ativa = true;
CREATE INDEX idx_lpu_rules_conditions ON lpu_rules USING gin(conditions);

-- =============================================================================
-- 10. PAYOUTS — cálculos de pagamento por visita
-- =============================================================================

CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,  -- 'YYYY-MM'
  status TEXT NOT NULL CHECK (status IN ('aberto', 'aguardando_aprovacao', 'aprovado', 'pago', 'reaberto')),
  total_a_pagar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_receita_unetvale NUMERIC(12, 2) NOT NULL DEFAULT 0,
  margem NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  total_oss INTEGER NOT NULL DEFAULT 0,
  aprovado_por UUID REFERENCES users(id),
  aprovado_em TIMESTAMPTZ,
  reaberto_por UUID REFERENCES users(id),
  reaberto_em TIMESTAMPTZ,
  reaberto_motivo TEXT,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, periodo),
  CHECK (periodo ~ '^\d{4}-\d{2}$')
);

CREATE INDEX idx_closings_tenant_status ON monthly_closings(tenant_id, status);
CREATE INDEX idx_closings_tenant_periodo ON monthly_closings(tenant_id, periodo DESC);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL UNIQUE REFERENCES service_visits(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
  lpu_id UUID REFERENCES lpus(id) ON DELETE SET NULL,
  lpu_rule_id UUID REFERENCES lpu_rules(id) ON DELETE SET NULL,
  reason_id UUID REFERENCES reasons(id) ON DELETE SET NULL,
  valor_calculado NUMERIC(10, 2),
  valor_deixado_na_mesa NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN (
    'pending_calculation',
    'pending_review',
    'pending',
    'approved',
    'paid',
    'contestado',
    'override',
    'no_rule_match',
    'pending_classification',
    'conflict'
  )),
  valor_override NUMERIC(10, 2),
  override_motivo TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMPTZ,
  closing_id UUID REFERENCES monthly_closings(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_tenant_status ON payouts(tenant_id, status);
CREATE INDEX idx_payouts_technician_status ON payouts(technician_id, status) WHERE technician_id IS NOT NULL;
CREATE INDEX idx_payouts_closing ON payouts(closing_id) WHERE closing_id IS NOT NULL;
CREATE INDEX idx_payouts_pendentes ON payouts(tenant_id, status) WHERE status IN (
  'pending_calculation', 'pending_review', 'no_rule_match', 'pending_classification', 'conflict'
);

-- =============================================================================
-- 11. AUDITORIA
-- =============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

CREATE TABLE service_visits_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES service_visits(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  before JSONB NOT NULL,
  after JSONB NOT NULL
);

CREATE INDEX idx_visits_audit_visit ON service_visits_audit(visit_id, changed_at DESC);

CREATE TABLE lpu_rules_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES lpu_rules(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  before JSONB NOT NULL,
  after JSONB NOT NULL
);

CREATE INDEX idx_lpu_rules_audit_rule ON lpu_rules_audit(rule_id, changed_at DESC);

CREATE TABLE payouts_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  before JSONB NOT NULL,
  after JSONB NOT NULL
);

CREATE INDEX idx_payouts_audit_payout ON payouts_audit(payout_id, changed_at DESC);

-- =============================================================================
-- 12. NOTIFICAÇÕES
-- =============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notif_user_all ON notifications(user_id, created_at DESC);

-- =============================================================================
-- 13. TRIGGERS — updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_technicians_updated BEFORE UPDATE ON technicians FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_so_updated BEFORE UPDATE ON service_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON service_visits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reasons_updated BEFORE UPDATE ON reasons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lpus_updated BEFORE UPDATE ON lpus FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lpu_rules_updated BEFORE UPDATE ON lpu_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payouts_updated BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_closings_updated BEFORE UPDATE ON monthly_closings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 14. TRIGGER — consolidação de service_orders ao mudar service_visits
-- =============================================================================

CREATE OR REPLACE FUNCTION consolidar_service_order(p_tenant_id UUID, p_os_num BIGINT)
RETURNS VOID AS $$
DECLARE
  v_total_visitas INTEGER;
  v_data_resolucao TIMESTAMPTZ;
  v_tentativas INTEGER;
  v_status TEXT;
  v_custo NUMERIC(10, 2);
  v_receita NUMERIC(10, 2);
  v_finalidade TEXT;
  v_cidade TEXT;
  v_inicio TIMESTAMPTZ;
  v_cliente TEXT;
  v_contrato TEXT;
  v_condo BOOLEAN;
  v_cat1 TEXT;
  v_cat2 TEXT;
  v_cat3 TEXT;
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
    -- Não há mais visitas — apaga consolidação
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
    total_visitas = EXCLUDED.total_visitas,
    data_resolucao = EXCLUDED.data_resolucao,
    tentativas_ate_sucesso = EXCLUDED.tentativas_ate_sucesso,
    status_consolidado = EXCLUDED.status_consolidado,
    custo_total = EXCLUDED.custo_total,
    receita_total = EXCLUDED.receita_total,
    finalidade = EXCLUDED.finalidade,
    cidade = EXCLUDED.cidade,
    condominio = EXCLUDED.condominio,
    cat1 = EXCLUDED.cat1,
    cat2 = EXCLUDED.cat2,
    cat3 = EXCLUDED.cat3,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_visit_consolidar()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM consolidar_service_order(
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.os_num, OLD.os_num)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_consolidar_so
  AFTER INSERT OR UPDATE OR DELETE ON service_visits
  FOR EACH ROW EXECUTE FUNCTION trg_visit_consolidar();

CREATE TRIGGER trg_payout_consolidar_so
  AFTER INSERT OR UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION trg_visit_consolidar();

-- =============================================================================
-- 15. TRIGGERS DE AUDITORIA
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_audit_visits()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO service_visits_audit(visit_id, upload_id, changed_by, before, after)
    VALUES (NEW.id, NEW.upload_id, NULL, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visits_audit_changes
  AFTER UPDATE ON service_visits
  FOR EACH ROW EXECUTE FUNCTION trg_audit_visits();

CREATE OR REPLACE FUNCTION trg_audit_lpu_rules()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO lpu_rules_audit(rule_id, changed_by, before, after)
    VALUES (NEW.id, NULL, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lpu_rules_audit_changes
  AFTER UPDATE ON lpu_rules
  FOR EACH ROW EXECUTE FUNCTION trg_audit_lpu_rules();

CREATE OR REPLACE FUNCTION trg_audit_payouts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO payouts_audit(payout_id, changed_by, before, after)
    VALUES (NEW.id, NEW.override_by, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payouts_audit_changes
  AFTER UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION trg_audit_payouts();

-- =============================================================================
-- 16. RLS — Row Level Security
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpu_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_visits_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpu_rules_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts_audit ENABLE ROW LEVEL SECURITY;

-- Helper: pega tenant_id do JWT
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_technician_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'technician_id', '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_tallpa_owner() RETURNS BOOLEAN AS $$
  SELECT current_user_role() = 'tallpa_owner';
$$ LANGUAGE sql STABLE;

-- Policy padrão para tabelas de domínio: tenant_id deve bater com JWT, ou tallpa_owner
CREATE POLICY tenant_isolation ON technicians FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);
CREATE POLICY tenant_isolation ON uploads FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);
CREATE POLICY tenant_isolation ON service_orders FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);
CREATE POLICY tenant_isolation ON reasons FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);
CREATE POLICY tenant_isolation ON lpus FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);
CREATE POLICY tenant_isolation ON monthly_closings FOR ALL USING (
  tenant_id = current_tenant_id() OR is_tallpa_owner()
);

-- LPU rules: filtra via lpu.tenant_id
CREATE POLICY tenant_isolation ON lpu_rules FOR ALL USING (
  EXISTS (
    SELECT 1 FROM lpus l
    WHERE l.id = lpu_rules.lpu_id
      AND (l.tenant_id = current_tenant_id() OR is_tallpa_owner())
  )
);

-- Service visits: técnico só vê as suas; gestor vê todas do tenant
CREATE POLICY tenant_isolation ON service_visits FOR ALL USING (
  is_tallpa_owner()
  OR (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('tenant_owner', 'tenant_manager')
      OR (current_user_role() = 'tenant_technician' AND tecnico_id = current_technician_id())
    )
  )
);

CREATE POLICY tenant_isolation ON payouts FOR ALL USING (
  is_tallpa_owner()
  OR (
    tenant_id = current_tenant_id()
    AND (
      current_user_role() IN ('tenant_owner', 'tenant_manager')
      OR (current_user_role() = 'tenant_technician' AND technician_id = current_technician_id())
    )
  )
);

-- Tenants: leitura pública limitada de campos não-sensíveis para middleware
CREATE POLICY tenants_public_read ON tenants FOR SELECT USING (true);
CREATE POLICY tenants_admin_write ON tenants FOR ALL USING (is_tallpa_owner());

-- Users: ver a si mesmo + tenant_owner/manager veem do mesmo tenant + tallpa_owner vê todos
CREATE POLICY users_self_read ON users FOR SELECT USING (
  id = auth.uid()
  OR is_tallpa_owner()
  OR (current_user_role() IN ('tenant_owner', 'tenant_manager') AND tenant_id = current_tenant_id())
);
CREATE POLICY users_admin_write ON users FOR ALL USING (
  is_tallpa_owner()
  OR (current_user_role() = 'tenant_owner' AND tenant_id = current_tenant_id())
);

-- Notifications: cada usuário vê as suas
CREATE POLICY notif_own ON notifications FOR ALL USING (
  user_id = auth.uid() OR is_tallpa_owner()
);

-- Audit logs: só tallpa_owner e tenant_owner do tenant
CREATE POLICY audit_read ON audit_log FOR SELECT USING (
  is_tallpa_owner()
  OR (current_user_role() = 'tenant_owner' AND tenant_id = current_tenant_id())
);

CREATE POLICY visits_audit_read ON service_visits_audit FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM service_visits v
    WHERE v.id = service_visits_audit.visit_id
      AND (v.tenant_id = current_tenant_id() OR is_tallpa_owner())
  )
);

CREATE POLICY lpu_audit_read ON lpu_rules_audit FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lpu_rules r
    JOIN lpus l ON l.id = r.lpu_id
    WHERE r.id = lpu_rules_audit.rule_id
      AND (l.tenant_id = current_tenant_id() OR is_tallpa_owner())
  )
);

CREATE POLICY payouts_audit_read ON payouts_audit FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM payouts p
    WHERE p.id = payouts_audit.payout_id
      AND (p.tenant_id = current_tenant_id() OR is_tallpa_owner())
  )
);

-- =============================================================================
-- FIM DA MIGRATION 0001
-- =============================================================================