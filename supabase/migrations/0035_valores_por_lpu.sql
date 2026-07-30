-- =============================================================================
-- 0035 — Valores de payout por LPU (fundação para a tabela "SEM AUXILIAR")
--
-- CONTEXTO
--   O ADR-014 permitiu atribuir uma LPU alternativa a um técnico, mas só o motor de LPU
--   passou a resolver por técnico. Quatro valores continuaram GLOBAIS (por tenant ou
--   constantes no código):
--     · acréscimo por ponto adicional  R$ 36   (constante em calculate.ts, ADR-016)
--     · repasse de improdutiva padrão  R$ 15   (constante em calculate.ts)
--     · acréscimo de domingo/feriado   15%     (tenants.config.feriado_acrescimo_pct, ADR-011)
--     · classificações de cabeamento e de homologação  (por tenant, ADR-009 e ADR-015)
--
--   A tabela "SEM AUXILIAR" tem valores próprios para todos eles (ponto R$ 30, improdutiva
--   R$ 10, feriado 10%, cabeamento R$ 30/60/90, homologação R$ 30). Sem esta migration, um
--   técnico com a LPU alternativa receberia instalação/suporte pela tabela nova e TODO o
--   resto pelos valores da padrão — pagamento misturado entre duas tabelas.
--
-- DECISÃO (usuário, 30/07/2026): a LPU nova é auto-contida e a tabela em uso hoje NÃO muda
--   em nada. Por isso todas as colunas aqui são NULLABLE e o motor trata NULL como "usa o
--   valor de hoje". A LPU padrão fica com tudo NULL → comportamento idêntico ao atual.
--
-- Não altera dado existente: só acrescenta colunas nulas. FORMA DE EXECUÇÃO: SQL Editor.
-- Idempotente (IF NOT EXISTS). Sem necessidade de recálculo — nada muda até uma LPU receber
-- valores e ser atribuída a um técnico.
-- =============================================================================

-- 1. Valores escalares próprios da tabela de preços. NULL = usa o padrão vigente.
ALTER TABLE lpus
  ADD COLUMN IF NOT EXISTS ponto_adicional_valor  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS improdutiva_valor      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS feriado_acrescimo_pct  NUMERIC(5,2);

COMMENT ON COLUMN lpus.ponto_adicional_valor IS
  'ADR-016: acréscimo por ponto adicional da coluna Z. NULL = usa a constante padrão (R$ 36).';
COMMENT ON COLUMN lpus.improdutiva_valor IS
  'Repasse da improdutiva padrão (Unetvale R$ 15,98). NULL = usa a constante padrão (R$ 15).';
COMMENT ON COLUMN lpus.feriado_acrescimo_pct IS
  'ADR-011: acréscimo de domingo/feriado. NULL = usa tenants.config.feriado_acrescimo_pct.';

-- 2. Classificações de cabeamento e homologação passam a poder ser específicas de uma LPU.
--    NULL = classificação do tenant (todas as existentes permanecem assim, valendo como hoje).
ALTER TABLE cabeamento_classifications
  ADD COLUMN IF NOT EXISTS lpu_id UUID REFERENCES lpus(id) ON DELETE CASCADE;

ALTER TABLE homologacao_classifications
  ADD COLUMN IF NOT EXISTS lpu_id UUID REFERENCES lpus(id) ON DELETE CASCADE;

COMMENT ON COLUMN cabeamento_classifications.lpu_id IS
  'ADR-019: classificação específica de uma LPU. NULL = vale para o tenant (comportamento ADR-009).';
COMMENT ON COLUMN homologacao_classifications.lpu_id IS
  'ADR-019: repasse específico de uma LPU. NULL = vale para o tenant (comportamento ADR-015).';

-- 3. Unicidade por escopo. Os UNIQUE originais são (tenant_id, chave) e não distinguem LPU;
--    trocamos por índices únicos parciais: um para as linhas do tenant (lpu_id NULL) e outro
--    para as de LPU. Assim a mesma chave pode ter um valor no tenant e outro na LPU nova.
-- Busca a constraint pelas COLUNAS que ela cobre, não pelo nome: o nome automático do
-- Postgres muda se a tabela for recriada, e um DROP por nome fixo falharia em silêncio.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass::text AS tabela, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'u'
      AND c.conrelid IN (
        'cabeamento_classifications'::regclass,
        'homologacao_classifications'::regclass
      )
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) IN (
        ARRAY['explicacao_key', 'tenant_id'],
        ARRAY['tenant_id', 'valor_unetvale']
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabela, r.conname);
    RAISE NOTICE 'UNIQUE antigo removido: %.%', r.tabela, r.conname;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cabeamento_class_tenant
  ON cabeamento_classifications(tenant_id, explicacao_key) WHERE lpu_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cabeamento_class_lpu
  ON cabeamento_classifications(lpu_id, explicacao_key) WHERE lpu_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_homologacao_class_tenant
  ON homologacao_classifications(tenant_id, valor_unetvale) WHERE lpu_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_homologacao_class_lpu
  ON homologacao_classifications(lpu_id, valor_unetvale) WHERE lpu_id IS NOT NULL;

-- ── Conferência: nada mudou para a LPU em uso ─────────────────────────────────────────────
-- Esperado: a LPU ativa com as três colunas NULL, e todas as classificações com lpu_id NULL.
SELECT nome, ativa, ponto_adicional_valor, improdutiva_valor, feriado_acrescimo_pct
FROM lpus ORDER BY ativa DESC, nome;

SELECT 'cabeamento' AS tabela,
       count(*) FILTER (WHERE lpu_id IS NULL) AS do_tenant,
       count(*) FILTER (WHERE lpu_id IS NOT NULL) AS de_lpu
FROM cabeamento_classifications
UNION ALL
SELECT 'homologacao',
       count(*) FILTER (WHERE lpu_id IS NULL),
       count(*) FILTER (WHERE lpu_id IS NOT NULL)
FROM homologacao_classifications;
