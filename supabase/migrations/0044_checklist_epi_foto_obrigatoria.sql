-- =============================================================================
-- 0044 — Checklist de EPI: foto obrigatória por item, escalas de resposta e seed
--        (ADR-022 · Sprint 19)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Sem BEGIN/COMMIT. Idempotente.
-- Aplicar colando no SQL Editor do Supabase.
--
-- ── ORIGEM ────────────────────────────────────────────────────────────────────────────────
-- A ficha que a Wave usava no Google Forms ("FICHA DE CHECKLIST DE EPI/EPC PRESENCIAL"):
-- 29 itens de POSSE de EPI, 19 de USO, mais fotos, nota 1-10, empresa, cluster e parecer.
--
-- Três problemas dela que esta migration resolve:
--
--   1. As fotos ficavam SOLTAS no topo (até 10 arquivos), sem ligação com o item. Ninguém
--      sabia a qual EPI cada foto se referia, e o supervisor podia simplesmente não anexar.
--   2. As duas grades usavam ESCALAS DIFERENTES, e a diferença é operacional: em posse,
--      "Não possui" e "Necessário trocar" pedem ações distintas do gestor.
--   3. Os itens eram fixos no formulário: mudar a ficha fazia as antigas não baterem com as
--      novas.
--
-- ── DECISÃO (Jhoni Cleyton, 2026-09-19) ───────────────────────────────────────────────────
-- Quem decide se um item exige foto é o GESTOR, no template — não o supervisor em campo.
-- Assim não há o que esquecer nem o que pular: a conclusão trava enquanto faltar foto num
-- item marcado.
--
-- ── O QUE ESTE ARQUIVO FAZ ────────────────────────────────────────────────────────────────
-- Colunas novas, todas com DEFAULT (nenhuma quebra linha existente):
--   supervision_checklist_items: foto_obrigatoria, tipo_resposta
--   supervision_answers:         item_foto_obrigatoria, item_tipo_resposta  (snapshot)
--   field_supervisions:          nota_qualidade_tecnica, empresa, cluster
--
-- Amplia DOIS CHECKs de tabelas criadas na 0042:
--   chk_sup_answer_resposta  → aceita 'necessita_troca'
--   (novos CHECKs para tipo_resposta, nota_qualidade_tecnica e empresa)
--
-- ⚠️ Ampliar CHECK é DROP + ADD. O risco normal disso é a tabela ficar sem constraint se o
--    ADD falhar — mas aqui as duas tabelas são da 0042 e estão VAZIAS (nenhuma supervisão
--    foi criada ainda). A Conferência 0 confirma antes de aplicar.
--
-- Não toca service_visits, service_orders, payouts, o auth hook, os papéis nem a RLS.
--
-- ── REVERSÃO ──────────────────────────────────────────────────────────────────────────────
-- supabase/rollback/0044_checklist_epi_foto_obrigatoria.down.sql
-- =============================================================================


-- ── CONFERÊNCIA 0 — rodar ANTES ───────────────────────────────────────────────────────────
-- Esperado: as duas com 0. Se houver supervisão registrada, PARE e reavalie: ampliar o CHECK
-- de resposta com dados dentro merece conferência linha a linha.
SELECT
  (SELECT count(*) FROM field_supervisions)  AS supervisoes,
  (SELECT count(*) FROM supervision_answers) AS respostas;


-- ── 1. Item do checklist: foto obrigatória e escala de resposta ───────────────────────────
ALTER TABLE supervision_checklist_items
  ADD COLUMN IF NOT EXISTS foto_obrigatoria BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE supervision_checklist_items
  ADD COLUMN IF NOT EXISTS tipo_resposta TEXT NOT NULL DEFAULT 'conformidade';

ALTER TABLE supervision_checklist_items DROP CONSTRAINT IF EXISTS chk_sup_item_tipo_resposta;
ALTER TABLE supervision_checklist_items ADD CONSTRAINT chk_sup_item_tipo_resposta
  CHECK (tipo_resposta IN ('conformidade', 'posse_epi', 'uso_epi'));


-- ── 2. Resposta: snapshot das duas colunas novas ──────────────────────────────────────────
-- Mesmo princípio do resto do snapshot (ADR-022): a supervisão agendada carrega sua própria
-- cópia. Trocar a escala ou a exigência de foto no template não altera supervisão em curso.
ALTER TABLE supervision_answers
  ADD COLUMN IF NOT EXISTS item_foto_obrigatoria BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE supervision_answers
  ADD COLUMN IF NOT EXISTS item_tipo_resposta TEXT NOT NULL DEFAULT 'conformidade';

-- 'necessita_troca': equipamento existe mas está gasto. Conta como falha na nota, igual a
-- 'nao_conforme', e é contado à parte porque a ação do gestor é outra.
ALTER TABLE supervision_answers DROP CONSTRAINT IF EXISTS chk_sup_answer_resposta;
ALTER TABLE supervision_answers ADD CONSTRAINT chk_sup_answer_resposta
  CHECK (resposta IS NULL OR resposta IN
    ('conforme', 'nao_conforme', 'necessita_troca', 'nao_se_aplica'));

ALTER TABLE supervision_answers DROP CONSTRAINT IF EXISTS chk_sup_answer_tipo_resposta;
ALTER TABLE supervision_answers ADD CONSTRAINT chk_sup_answer_tipo_resposta
  CHECK (item_tipo_resposta IN ('conformidade', 'posse_epi', 'uso_epi'));

-- Fila do supervisor: "quais itens ainda me devem foto". Parcial porque é minoria dos itens.
CREATE INDEX IF NOT EXISTS idx_sup_answers_exigem_foto
  ON supervision_answers(supervisao_id) WHERE item_foto_obrigatoria;


-- ── 3. Supervisão: campos que a ficha tinha e o modelo não ────────────────────────────────
-- Impressão geral do supervisor, de 1 a 10. NÃO se confunde com `nota`, que é calculada do
-- checklist: uma é julgamento, a outra é medida.
ALTER TABLE field_supervisions
  ADD COLUMN IF NOT EXISTS nota_qualidade_tecnica INTEGER;

ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_qualidade;
ALTER TABLE field_supervisions ADD CONSTRAINT chk_field_sup_qualidade
  CHECK (nota_qualidade_tecnica IS NULL
         OR (nota_qualidade_tecnica >= 1 AND nota_qualidade_tecnica <= 10));

-- Contratante da visita. TEXT com CHECK em vez de enum: a lista muda com contrato novo, e
-- mexer em enum do Postgres é bem mais caro que trocar um CHECK.
ALTER TABLE field_supervisions
  ADD COLUMN IF NOT EXISTS empresa TEXT;

ALTER TABLE field_supervisions DROP CONSTRAINT IF EXISTS chk_field_sup_empresa;
ALTER TABLE field_supervisions ADD CONSTRAINT chk_field_sup_empresa
  CHECK (empresa IS NULL OR empresa IN ('unifique', 'unetvale'));

-- Região da operação. Texto livre de propósito: a lista de clusters é da Unetvale e muda sem
-- aviso — um CHECK aqui viraria migration a cada mudança dela.
ALTER TABLE field_supervisions
  ADD COLUMN IF NOT EXISTS cluster TEXT;


-- ── 4. SEED — os 48 itens da ficha de EPI, só para o tenant `wave` ────────────────────────
-- Idempotente por (tenant_id, lower(codigo)), que é o índice único da 0042: reexecutar não
-- duplica. Ajustes finos ficam por conta do gestor, na tela.
--
-- Foto obrigatória nos itens de RISCO DE VIDA (trabalho em altura e risco elétrico): é onde a
-- evidência importa e onde a palavra do supervisor sozinha não basta.

INSERT INTO supervision_checklist_items
  (tenant_id, codigo, titulo, categoria, tipo_resposta, foto_obrigatoria, ordem)
SELECT t.id, v.codigo, v.titulo, v.categoria, v.tipo_resposta, v.foto_obrigatoria, v.ordem
FROM tenants t
CROSS JOIN (VALUES
  -- ── Posse de EPI (29) ───────────────────────────────────────────────────────────────────
  ('POSSE-01', 'Capacete aba total classe "B" com jugular',        'Posse de EPI', 'posse_epi', true,  10),
  ('POSSE-02', 'Cinto de segurança tipo paraquedista',             'Posse de EPI', 'posse_epi', true,  11),
  ('POSSE-03', 'Calçado de segurança',                             'Posse de EPI', 'posse_epi', true,  12),
  ('POSSE-04', 'Talabarte de posicionamento',                      'Posse de EPI', 'posse_epi', true,  13),
  ('POSSE-05', 'Trava-quedas',                                     'Posse de EPI', 'posse_epi', true,  14),
  ('POSSE-06', 'Cones (5 por escada)',                             'Posse de EPI', 'posse_epi', false, 15),
  ('POSSE-07', 'Óculos de segurança transparente',                 'Posse de EPI', 'posse_epi', false, 16),
  ('POSSE-08', 'Óculos de segurança fumê',                         'Posse de EPI', 'posse_epi', false, 17),
  ('POSSE-09', 'Luva isolante BT',                                 'Posse de EPI', 'posse_epi', true,  18),
  ('POSSE-10', 'Luva de vaqueta (curta)',                          'Posse de EPI', 'posse_epi', false, 19),
  ('POSSE-11', 'Vestimenta de segurança — calça',                  'Posse de EPI', 'posse_epi', false, 20),
  ('POSSE-12', 'Vestimenta de segurança — jaqueta',                'Posse de EPI', 'posse_epi', false, 21),
  ('POSSE-13', 'Protetor solar',                                   'Posse de EPI', 'posse_epi', false, 22),
  ('POSSE-14', 'Detector de tensão',                               'Posse de EPI', 'posse_epi', true,  23),
  ('POSSE-15', 'Fita de ancoragem Eureka',                         'Posse de EPI', 'posse_epi', false, 24),
  ('POSSE-16', 'Corda de 2 metros para amarração de topo',         'Posse de EPI', 'posse_epi', false, 25),
  ('POSSE-17', 'Corda de 20 metros para linha de vida',            'Posse de EPI', 'posse_epi', true,  26),
  ('POSSE-18', 'Fita de ancoragem 1,5 m',                          'Posse de EPI', 'posse_epi', false, 27),
  ('POSSE-19', 'Fita de ancoragem 2,0 m',                          'Posse de EPI', 'posse_epi', false, 28),
  ('POSSE-20', 'Mosquetão (4 unidades)',                           'Posse de EPI', 'posse_epi', false, 29),
  ('POSSE-21', 'Catraca — NBR 5426, NBR 15834 e NBR 15837',        'Posse de EPI', 'posse_epi', false, 30),
  ('POSSE-22', 'Capa de chuva',                                    'Posse de EPI', 'posse_epi', false, 31),
  ('POSSE-23', 'Luva de cobertura',                                'Posse de EPI', 'posse_epi', false, 32),
  ('POSSE-24', 'Crachá',                                           'Documentação', 'posse_epi', false, 33),
  ('POSSE-25', 'Ímã lateral do carro',                             'Veículo',      'posse_epi', false, 34),
  ('POSSE-26', 'Bandeira de sinalização (escada)',                 'Posse de EPI', 'posse_epi', false, 35),
  ('POSSE-27', 'Carteira da Celesc',                               'Documentação', 'posse_epi', false, 36),
  ('POSSE-28', 'Sapata de borracha da escada (pé)',                'Posse de EPI', 'posse_epi', true,  37),
  ('POSSE-29', 'Carro em boas condições',                          'Veículo',      'posse_epi', true,  38),

  -- ── Uso de EPI (19) ─────────────────────────────────────────────────────────────────────
  ('USO-01', 'Capacete aba total com jugular',                     'Uso de EPI', 'uso_epi', true,  50),
  ('USO-02', 'Cinto de segurança',                                 'Uso de EPI', 'uso_epi', true,  51),
  ('USO-03', 'Calçado de segurança',                               'Uso de EPI', 'uso_epi', true,  52),
  ('USO-04', 'Talabarte de posicionamento',                        'Uso de EPI', 'uso_epi', true,  53),
  ('USO-05', 'Trava-quedas',                                       'Uso de EPI', 'uso_epi', true,  54),
  ('USO-06', 'Óculos de proteção transparente',                    'Uso de EPI', 'uso_epi', false, 55),
  ('USO-07', 'Óculos de proteção escuro',                          'Uso de EPI', 'uso_epi', false, 56),
  ('USO-08', 'Luva de vaqueta',                                    'Uso de EPI', 'uso_epi', false, 57),
  ('USO-09', 'Calça antichama',                                    'Uso de EPI', 'uso_epi', false, 58),
  ('USO-10', 'Jaleco antichama',                                   'Uso de EPI', 'uso_epi', false, 59),
  ('USO-11', 'Fitas de ancoragem',                                 'Uso de EPI', 'uso_epi', false, 60),
  ('USO-12', 'Fita Eureka',                                        'Uso de EPI', 'uso_epi', false, 61),
  ('USO-13', 'Medidor de tensão',                                  'Uso de EPI', 'uso_epi', true,  62),
  ('USO-14', 'Mosquetões (4 unidades)',                            'Uso de EPI', 'uso_epi', false, 63),
  ('USO-15', 'Catraca de amarração da escada',                     'Uso de EPI', 'uso_epi', false, 64),
  ('USO-16', 'Luva BT',                                            'Uso de EPI', 'uso_epi', true,  65),
  ('USO-17', 'Luva de cobertura',                                  'Uso de EPI', 'uso_epi', false, 66),
  ('USO-18', 'Corda de topo',                                      'Uso de EPI', 'uso_epi', false, 67),
  ('USO-19', 'Corda de linha de vida de 20 m',                     'Uso de EPI', 'uso_epi', true,  68)
) AS v(codigo, titulo, categoria, tipo_resposta, foto_obrigatoria, ordem)
WHERE t.slug = 'wave'
ON CONFLICT DO NOTHING;


-- =============================================================================
-- CONFERÊNCIAS — rodar depois de aplicar
-- =============================================================================

-- ── 1. Colunas novas existem, com os defaults certos ──────────────────────────────────────
-- Esperado: 7 linhas. Nenhuma com is_nullable='NO' e column_default nulo.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name = 'supervision_checklist_items'
         AND column_name IN ('foto_obrigatoria', 'tipo_resposta'))
   OR (table_name = 'supervision_answers'
         AND column_name IN ('item_foto_obrigatoria', 'item_tipo_resposta'))
   OR (table_name = 'field_supervisions'
         AND column_name IN ('nota_qualidade_tecnica', 'empresa', 'cluster'))
ORDER BY table_name, column_name;

-- ── 2. O CHECK de resposta aceita os QUATRO estados ───────────────────────────────────────
-- Esperado: a definição contém 'necessita_troca'.
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'supervision_answers'::regclass AND conname = 'chk_sup_answer_resposta';

-- ── 3. Seed: 48 itens, e quantos exigem foto ──────────────────────────────────────────────
-- Esperado: Posse de EPI 25, Uso de EPI 19, Documentação 2, Veículo 2 — total 48.
SELECT categoria,
       count(*)                                  AS itens,
       count(*) FILTER (WHERE foto_obrigatoria)  AS exigem_foto
FROM supervision_checklist_items
GROUP BY ROLLUP(categoria)
ORDER BY categoria NULLS LAST;

-- ── 4. Reexecução não duplica ─────────────────────────────────────────────────────────────
-- Esperado: 0 linhas. Rode a migration duas vezes e confirme que continua vazio.
SELECT lower(codigo) AS codigo, count(*)
FROM supervision_checklist_items
WHERE codigo IS NOT NULL
GROUP BY lower(codigo) HAVING count(*) > 1;

-- ── 5. REGRA DE OURO: nada existente mudou ────────────────────────────────────────────────
-- Esperado: a MESMA contagem de sempre — payouts 3, service_orders 1, service_visits 3.
SELECT c.relname AS tabela, count(*) AS triggers
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND c.relname IN ('service_visits', 'payouts', 'service_orders')
GROUP BY c.relname ORDER BY c.relname;
