-- =============================================================================
-- 0042 — Módulo Supervisão de Campo (ADR-022 · Sprint 19)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Sem BEGIN/COMMIT: o SQL Editor roda
-- statement a statement em autocommit. Idempotente e reexecutável.
-- Aplicar colando no SQL Editor do Supabase.
--
-- ── PROBLEMA ──────────────────────────────────────────────────────────────────────────────
-- O papel `tenant_supervisor` existe desde a 0009 mas é somente leitura: uma tela,
-- /minha-equipe, com KPIs da equipe. Não há onde o gestor agendar um acompanhamento em campo,
-- nem onde o supervisor registrar o que viu, nem evidência fotográfica, nem nota.
--
-- ── DECISÃO (Jhoni Cleyton, 2026-09-18 · ADR-022) ─────────────────────────────────────────
-- A supervisão vive em TABELAS PRÓPRIAS e NUNCA escreve em service_visits, service_orders ou
-- payouts. O isolamento é ESTRUTURAL, não disciplinar.
--
-- Por que isso importa: `consolidar_service_order(tenant, os_num)` (0011) agrega service_visits
-- por tenant + os_num SEM NENHUM FILTRO e dispara por trigger em service_visits E em payouts.
-- Como este módulo não escreve nessas duas tabelas, a função NUNCA é invocada — e nenhum dos
-- ~50 pontos que consultam OSs e visitas precisa mudar.
--
-- O contra-exemplo está neste repositório: `fora_escopo` existe desde a 0013 e a função de
-- consolidação NUNCA foi ajustada para respeitá-lo (0013, 0028, 0033 passaram sem tocá-la).
-- Um discriminador que precisa ser lembrado em 50 lugares é um vazamento agendado.
--
-- ── O QUE ESTE ARQUIVO NÃO FAZ ────────────────────────────────────────────────────────────
-- Não altera NENHUMA tabela, coluna, função, trigger, política RLS, enum ou CHECK existente.
-- Não toca service_visits, service_orders, payouts, consolidar_service_order(), o auth hook
-- (custom_jwt_claims) nem os 5 papéis. Não cria papel novo.
-- Não toca o bucket `uploads` nem suas 3 policies (os predicados são disjuntos por bucket_id).
--
-- Único efeito sobre estrutura existente: escreve a chave de feature flag
-- `supervisao_campo_habilitada` = false em tenants.config (aditivo, jsonb_set com
-- create_missing = true, guardado por WHERE — não religa nem desliga tenant já configurado).
--
-- ── ANTES DE APLICAR ──────────────────────────────────────────────────────────────────────
-- Rodar a Conferência 7 (fim deste arquivo) e ANOTAR o resultado. Depois de aplicar, ela tem
-- de bater exatamente. É a prova de que nada existente mudou.
--
-- ── REVERSÃO ──────────────────────────────────────────────────────────────────────────────
-- Nível 1 (padrão, para incidente, zero perda de dados): desligar a flag.
--   UPDATE tenants SET config = jsonb_set(config, '{supervisao_campo_habilitada}',
--     'false'::jsonb, true) WHERE slug = 'wave';
-- Nível 2 (só para abandono definitivo, DESTRUTIVO):
--   supabase/rollback/0042_supervisao_campo.down.sql
-- =============================================================================


-- ── 1. TEMPLATE DE CHECKLIST — configurável pelo gestor, por tenant ───────────────────────
CREATE TABLE IF NOT EXISTS supervision_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Código curto opcional ("EPI-01") para o gestor referenciar em treinamento.
  codigo      TEXT,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  -- Agrupador livre na UI ("Segurança", "Qualidade da emenda", "Atendimento").
  categoria   TEXT,
  -- Peso 1 por padrão => a nota é a proporção simples de itens conformes. O peso existe para
  -- o gestor tornar um item crítico sem que a fórmula precise mudar depois.
  peso        NUMERIC(6,2) NOT NULL DEFAULT 1,
  ordem       INTEGER NOT NULL DEFAULT 0,
  -- Soft delete: o CRUD NUNCA faz DELETE. Desativar preserva a FK das respostas históricas.
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sup_item_peso_positivo CHECK (peso > 0),
  CONSTRAINT chk_sup_item_titulo_nao_vazio CHECK (length(btrim(titulo)) > 0)
);

-- Código único por tenant quando informado, case-insensitive. Parcial: NULL fica livre.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sup_item_codigo
  ON supervision_checklist_items(tenant_id, lower(codigo))
  WHERE codigo IS NOT NULL;

-- A query quente é "itens ativos do tenant, na ordem" — montagem do snapshot no agendamento.
CREATE INDEX IF NOT EXISTS idx_sup_items_tenant_ordem
  ON supervision_checklist_items(tenant_id, ordem)
  WHERE ativo;

DROP TRIGGER IF EXISTS set_updated_at ON supervision_checklist_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON supervision_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 2. A SUPERVISÃO ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_supervisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- tecnico_id em PORTUGUÊS: casa com service_visits e iqi_snapshots. Nome errado de coluna
  -- faz o PostgREST devolver vazio EM SILÊNCIO (CLAUDE.md §6).
  tecnico_id          UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  -- users.id do supervisor responsável (NÃO technicians.id). É por ele que a RLS do supervisor
  -- filtra, comparando direto com auth.uid(), sem join.
  supervisor_user_id  UUID NOT NULL,
  agendada_por        UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelada_por       UUID REFERENCES users(id) ON DELETE SET NULL,

  status              TEXT NOT NULL DEFAULT 'agendada',
  -- DATE e não TIMESTAMPTZ de propósito: "dia da supervisão" não tem hora, e timestamptz com
  -- toLocaleDateString gera off-by-one de um dia em America/Sao_Paulo.
  data_agendada       DATE NOT NULL,
  local_referencia    TEXT,

  -- ⚠️ MERAMENTE INFORMATIVO. SEM CHAVE ESTRANGEIRA DE PROPÓSITO: é a anotação de qual OS o
  -- técnico estava executando durante a supervisão. NÃO vincula a supervisão à OS, NÃO entra
  -- em consolidar_service_order(), NÃO afeta total_visitas e NÃO é chave de join (ADR-022 D2).
  os_num_referencia   INTEGER,

  observacoes_gestor  TEXT,
  iniciada_em         TIMESTAMPTZ,
  concluida_em        TIMESTAMPTZ,
  cancelada_em        TIMESTAMPTZ,
  motivo_cancelamento TEXT,

  -- Parecer categórico do supervisor, independente da nota numérica.
  parecer_final       TEXT,
  parecer_observacao  TEXT,

  -- Nota CONGELADA na conclusão. Nunca recalculada em leitura — mesmo princípio de
  -- payouts.valor_calculado.
  nota                NUMERIC(5,2),
  nota_calculada_em   TIMESTAMPTZ,
  -- Contadores denormalizados para a lista do gestor não precisar agregar as respostas.
  itens_total         INTEGER,
  itens_conformes     INTEGER,
  itens_nao_conformes INTEGER,
  itens_nao_aplica    INTEGER,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- FK NOMEADA: esta tabela tem 3 FKs para users (supervisor, agendada_por, cancelada_por).
  -- Sem nome explícito o embed do PostgREST — users(...) — fica AMBÍGUO e a query falha.
  CONSTRAINT fk_field_sup_supervisor
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE RESTRICT,

  CONSTRAINT chk_field_sup_status
    CHECK (status IN ('agendada', 'em_execucao', 'concluida', 'cancelada')),
  CONSTRAINT chk_field_sup_parecer
    CHECK (parecer_final IS NULL OR parecer_final IN
      ('aprovado', 'aprovado_com_ressalvas', 'reprovado', 'reciclagem_recomendada')),
  CONSTRAINT chk_field_sup_nota_faixa
    CHECK (nota IS NULL OR (nota >= 0 AND nota <= 100)),
  -- Concluída SEMPRE tem parecer e timestamp. A nota pode ser NULL (todos "não se aplica").
  CONSTRAINT chk_field_sup_concluida_completa
    CHECK (status <> 'concluida' OR (concluida_em IS NOT NULL AND parecer_final IS NOT NULL)),
  CONSTRAINT chk_field_sup_cancelada_completa
    CHECK (status <> 'cancelada' OR cancelada_em IS NOT NULL)
);

-- Lista do gestor: filtra por status, ordena por data.
CREATE INDEX IF NOT EXISTS idx_field_sup_tenant_status
  ON field_supervisions(tenant_id, status, data_agendada DESC);
-- Fila do supervisor no portal dele.
CREATE INDEX IF NOT EXISTS idx_field_sup_supervisor
  ON field_supervisions(supervisor_user_id, status, data_agendada DESC);
-- Histórico por técnico.
CREATE INDEX IF NOT EXISTS idx_field_sup_tecnico
  ON field_supervisions(tenant_id, tecnico_id, data_agendada DESC);
-- Busca pela OS mencionada (só informativa, mas é filtro de tela).
CREATE INDEX IF NOT EXISTS idx_field_sup_os_ref
  ON field_supervisions(tenant_id, os_num_referencia)
  WHERE os_num_referencia IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON field_supervisions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON field_supervisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 3. RESPOSTAS — snapshot congelado do template no momento do agendamento ───────────────
-- Camada 2 do versionamento (ADR-022 D3): a supervisão carrega sua própria cópia dos itens.
-- Editar ou desativar o template depois é INVISÍVEL para supervisão já agendada.
CREATE TABLE IF NOT EXISTS supervision_answers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supervisao_id      UUID NOT NULL REFERENCES field_supervisions(id) ON DELETE CASCADE,
  -- Desnormalizado de propósito: é por ele que a RLS do supervisor filtra, sem subquery em
  -- field_supervisions. Mesma decisão de unetvale_alteracoes.technician_id (0041).
  supervisor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Aponta para o item de origem só para rastreio. SET NULL porque a integridade da nota NÃO
  -- depende dele — as colunas item_* abaixo são a cópia congelada.
  item_id            UUID REFERENCES supervision_checklist_items(id) ON DELETE SET NULL,

  -- ── Snapshot do item ────────────────────────────────────────────────────────────────────
  ordem              INTEGER NOT NULL,
  item_codigo        TEXT,
  item_titulo        TEXT NOT NULL,
  item_descricao     TEXT,
  item_categoria     TEXT,
  item_peso          NUMERIC(6,2) NOT NULL DEFAULT 1,

  -- NULL = pendente. Concluir a supervisão exige zero pendentes (validado na Server Action).
  resposta           TEXT,
  observacao         TEXT,
  respondida_em      TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sup_answer_resposta
    CHECK (resposta IS NULL OR resposta IN ('conforme', 'nao_conforme', 'nao_se_aplica')),
  CONSTRAINT chk_sup_answer_peso_positivo CHECK (item_peso > 0),
  -- `ordem` é reatribuída sequencialmente no snapshot, então é única dentro da supervisão.
  -- Serve de chave estável para a UI e impede duplicar o mesmo item na mesma supervisão.
  CONSTRAINT uq_sup_answer_ordem UNIQUE (supervisao_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_sup_answers_supervisao
  ON supervision_answers(supervisao_id, ordem);
CREATE INDEX IF NOT EXISTS idx_sup_answers_supervisor
  ON supervision_answers(supervisor_user_id);
CREATE INDEX IF NOT EXISTS idx_sup_answers_item
  ON supervision_answers(item_id) WHERE item_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON supervision_answers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON supervision_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 4. FOTOS / EVIDÊNCIAS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supervision_photos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supervisao_id      UUID NOT NULL REFERENCES field_supervisions(id) ON DELETE CASCADE,
  -- Mesma razão de supervision_answers: RLS sem join.
  supervisor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- NULL = foto geral da supervisão; preenchido = evidência de um item específico.
  answer_id          UUID REFERENCES supervision_answers(id) ON DELETE CASCADE,

  storage_path       TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  tamanho_bytes      INTEGER,
  legenda            TEXT,
  enviada_por        UUID REFERENCES users(id) ON DELETE SET NULL,
  -- NULL até o browser confirmar o PUT. TODA leitura filtra uploaded_em IS NOT NULL: linha
  -- criada com PUT abortado vira lixo invisível, nunca foto quebrada na tela.
  uploaded_em        TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_sup_photo_path UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_sup_photos_supervisao
  ON supervision_photos(supervisao_id, created_at)
  WHERE uploaded_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sup_photos_answer
  ON supervision_photos(answer_id) WHERE answer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sup_photos_supervisor
  ON supervision_photos(supervisor_user_id);
-- Fila de limpeza de órfãs (linha criada, PUT nunca confirmado).
CREATE INDEX IF NOT EXISTS idx_sup_photos_orfas
  ON supervision_photos(tenant_id, created_at) WHERE uploaded_em IS NULL;

DROP TRIGGER IF EXISTS set_updated_at ON supervision_photos;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON supervision_photos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. RLS ────────────────────────────────────────────────────────────────────────────────
-- Duas diferenças deliberadas em relação ao template canônico (0020, 0022, 0041):
--
--   (a) NÃO existe ramo `tenant_technician`. É assim que o técnico fica de fora — ele não vê
--       a própria supervisão. Requisito de negócio gravado na RLS (ADR-022 D5).
--   (b) O ramo do supervisor usa supervisor_user_id = auth.uid(), NÃO supervisor_technicians.
--       A regra é "o supervisor vê as supervisões DELE", não "as da equipe dele".
--
-- Convenção do projeto: FOR ALL USING (...) sem WITH CHECK — o Postgres reaproveita a
-- expressão do USING como check de INSERT/UPDATE.

-- 5.1 Template: só gestor/owner. O supervisor lê o SNAPSHOT (supervision_answers), não o
--     template. O técnico não lê nada.
ALTER TABLE supervision_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supervision_checklist_items;
CREATE POLICY tenant_isolation ON supervision_checklist_items FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND current_user_role() IN ('tenant_owner', 'tenant_manager')
    )
  );

-- 5.2 Supervisão.
ALTER TABLE field_supervisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON field_supervisions;
CREATE POLICY tenant_isolation ON field_supervisions FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_supervisor' AND supervisor_user_id = auth.uid())
      )
    )
  );

-- 5.3 Respostas — mesmo predicado, pelo campo desnormalizado (sem join).
ALTER TABLE supervision_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supervision_answers;
CREATE POLICY tenant_isolation ON supervision_answers FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_supervisor' AND supervisor_user_id = auth.uid())
      )
    )
  );

-- 5.4 Fotos — idem.
ALTER TABLE supervision_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supervision_photos;
CREATE POLICY tenant_isolation ON supervision_photos FOR ALL
  USING (
    is_tallpa_owner()
    OR (
      tenant_id = current_tenant_id()
      AND (
        current_user_role() IN ('tenant_owner', 'tenant_manager')
        OR (current_user_role() = 'tenant_supervisor' AND supervisor_user_id = auth.uid())
      )
    )
  );


-- ── 6. GRANTs ─────────────────────────────────────────────────────────────────────────────
-- Sem GRANT o PostgREST devolve [] EM SILÊNCIO, antes mesmo de chegar na RLS (ver 0005/0007).
-- DELETE fica FORA do `authenticated` de propósito: nada neste módulo é apagado pela UI —
-- item vira ativo = false, supervisão vira status = 'cancelada'. service_role mantém DELETE
-- para manutenção e para a reversão de nível 2.
GRANT SELECT, INSERT, UPDATE ON TABLE supervision_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE field_supervisions          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE supervision_answers         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE supervision_photos          TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supervision_checklist_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE field_supervisions          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supervision_answers         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE supervision_photos          TO service_role;


-- ── 7. STORAGE — bucket privado de fotos de supervisão ────────────────────────────────────
-- Separado de `uploads` (XLSX, 10 MB): mime types, tamanho e ciclo de vida são outros.
-- NÃO toca o bucket existente nem suas policies — os predicados são disjuntos por bucket_id,
-- e políticas de storage.objects são PERMISSIVE (OR'd), então adicionar não restringe nada.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supervisao-fotos',
  'supervisao-fotos',
  false,
  5242880,  -- 5 MB. O cliente reencoda para JPEG ~800 KB antes do PUT; 5 MB é folga.
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Path: <tenant_id>/<supervisao_id>/<uuid>.jpg
--   foldername[1] = tenant     -> isolamento (mesmo predicado do bucket `uploads`)
--   foldername[2] = supervisão -> inspeção e limpeza triviais no painel
-- O técnico é excluído por current_user_role(). O gate real é a Server Action; estas policies
-- são defesa em profundidade para qualquer acesso client-side futuro.
DROP POLICY IF EXISTS "supervisao_fotos_insert" ON storage.objects;
CREATE POLICY "supervisao_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'supervisao-fotos'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
    AND current_user_role() IN ('tenant_owner', 'tenant_manager', 'tenant_supervisor')
  );

DROP POLICY IF EXISTS "supervisao_fotos_select" ON storage.objects;
CREATE POLICY "supervisao_fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'supervisao-fotos'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
    AND current_user_role() IN ('tenant_owner', 'tenant_manager', 'tenant_supervisor')
  );

DROP POLICY IF EXISTS "supervisao_fotos_delete" ON storage.objects;
CREATE POLICY "supervisao_fotos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'supervisao-fotos'
    AND (storage.foldername(name))[1] = (current_tenant_id())::text
    AND current_user_role() IN ('tenant_owner', 'tenant_manager')
  );


-- ── 8. FEATURE FLAG — nasce DESLIGADA para todo mundo ─────────────────────────────────────
-- Grava a chave explicitamente (ausente já seria "desligado", mas a chave presente é grepável
-- no banco e deixa o estado visível). O WHERE torna idempotente: reexecutar não religa nem
-- desliga tenant já configurado. Lida no código com === true (padrão homologacao_por_explicacao).
-- A flag NÃO vai para o JWT: o auth hook é intocável e flag em JWT só valeria após o refresh.
UPDATE tenants
SET config = jsonb_set(config, '{supervisao_campo_habilitada}', 'false'::jsonb, true)
WHERE NOT (config ? 'supervisao_campo_habilitada');


-- =============================================================================
-- CONFERÊNCIAS — rodar depois de aplicar
-- =============================================================================

-- ── 1. As 4 tabelas existem, com RLS ligada ───────────────────────────────────────────────
-- Esperado: 4 linhas, todas com rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('supervision_checklist_items', 'field_supervisions',
                    'supervision_answers', 'supervision_photos')
ORDER BY tablename;

-- ── 2. Policy tenant_isolation em cada uma ────────────────────────────────────────────────
-- Esperado: 4 linhas, policyname = 'tenant_isolation', cmd = 'ALL'.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('supervision_checklist_items', 'field_supervisions',
                    'supervision_answers', 'supervision_photos')
ORDER BY tablename;

-- ── 3. GRANTs para authenticated ──────────────────────────────────────────────────────────
-- Esperado: 12 linhas (4 tabelas x SELECT/INSERT/UPDATE). NENHUMA com DELETE.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_name IN ('supervision_checklist_items', 'field_supervisions',
                     'supervision_answers', 'supervision_photos')
ORDER BY table_name, privilege_type;

-- ── 4. Bucket criado e privado ────────────────────────────────────────────────────────────
-- Esperado: 1 linha, public = false, file_size_limit = 5242880.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'supervisao-fotos';

-- ── 5. Policies do bucket novo, SEM tocar as do bucket `uploads` ──────────────────────────
-- Esperado: as 3 'supervisao_fotos_*' E as 3 'uploads_tenant_*' INTACTAS.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- ── 6. Flag desligada em todos os tenants ─────────────────────────────────────────────────
-- Esperado: todos com habilitada = false.
SELECT slug, config -> 'supervisao_campo_habilitada' AS habilitada FROM tenants ORDER BY slug;

-- ── 7. REGRA DE OURO: nada existente mudou ────────────────────────────────────────────────
-- Rodar ANTES de aplicar a migration e ANOTAR. Depois de aplicar, tem de bater EXATAMENTE.
SELECT c.relname AS tabela, count(*) AS triggers
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('service_visits', 'payouts', 'service_orders')
GROUP BY c.relname ORDER BY c.relname;
