-- 0017 — Backfill de subterraneo_aereo a partir da explicacao_valor
--
-- Muitas visitas de sucesso chegaram com a coluna "Subterrâneo/Aéreo" vazia na planilha,
-- embora a "Explicação do valor" indique o meio ("... troca de drop aérea ..."). Como as
-- regras da LPU ativa fazem match EXATO por esse campo (Aéreo R$120 vs Subterrâneo R$135),
-- sem ele nenhuma regra casa e o pagamento fica "sem regra" (payout R$0), travando o
-- fechamento. O ETL passou a derivar esse campo da explicação na ingestão
-- (src/lib/etl/normalizer.ts — deriveSubterraneoAereo); esta migration repara o que já
-- foi gravado, usando a MESMA lógica (aére* → Aéreo; subterr* → Subterrâneo).
--
-- FORMA DE EXECUÇÃO: o SQL Editor do Supabase executa statement a statement (autocommit),
-- então este script NÃO usa BEGIN/COMMIT. O UPDATE é idempotente — só toca linhas com
-- subterraneo_aereo vazio/nulo; é seguro reexecutar quantas vezes for preciso.
--
-- IMPORTANTE: após aplicar, rodar "Recalcular pendentes" em /pagamentos — o match da LPU
-- ativa depende do campo recém-preenchido.

-- ============ Contagem ANTES (colar o resultado no acompanhamento) ============
SELECT 'ANTES vazio-derivável' AS etapa, count(*) AS linhas
FROM service_visits
WHERE (subterraneo_aereo IS NULL OR btrim(subterraneo_aereo) = '')
  AND explicacao_valor IS NOT NULL
  AND (public.immutable_unaccent(lower(explicacao_valor)) LIKE '%aere%'
       OR public.immutable_unaccent(lower(explicacao_valor)) LIKE '%subterr%');

-- ============ Backfill ============
UPDATE service_visits
SET subterraneo_aereo = CASE
  WHEN public.immutable_unaccent(lower(explicacao_valor)) LIKE '%aere%' THEN 'Aéreo'
  WHEN public.immutable_unaccent(lower(explicacao_valor)) LIKE '%subterr%' THEN 'Subterrâneo'
END
WHERE (subterraneo_aereo IS NULL OR btrim(subterraneo_aereo) = '')
  AND explicacao_valor IS NOT NULL
  AND (public.immutable_unaccent(lower(explicacao_valor)) LIKE '%aere%'
       OR public.immutable_unaccent(lower(explicacao_valor)) LIKE '%subterr%');

-- ============ Contagem DEPOIS (deve ser 0) ============
SELECT 'DEPOIS vazio-derivável' AS etapa, count(*) AS linhas
FROM service_visits
WHERE (subterraneo_aereo IS NULL OR btrim(subterraneo_aereo) = '')
  AND explicacao_valor IS NOT NULL
  AND (public.immutable_unaccent(lower(explicacao_valor)) LIKE '%aere%'
       OR public.immutable_unaccent(lower(explicacao_valor)) LIKE '%subterr%');

-- ============ Diagnóstico: visitas de sucesso ainda sem o campo (revisão manual) ============
-- São visitas de sucesso cujo campo continua vazio porque a explicação não indica o meio.
-- Podem precisar de nova regra de LPU ou preenchimento manual.
SELECT 'RESIDUAL sucesso sem meio' AS etapa, count(*) AS linhas
FROM service_visits
WHERE (subterraneo_aereo IS NULL OR btrim(subterraneo_aereo) = '')
  AND lower(btrim(sucesso)) LIKE 'sim%';
