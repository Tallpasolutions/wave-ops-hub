-- 0018 — Canonicaliza subterraneo_aereo (conserta mojibake + deriva vazios da explicação)
--
-- As regras da LPU fazem match EXATO por subterraneo_aereo (Aéreo R$120 vs Subterrâneo
-- R$135). Duas causas deixavam visitas de sucesso "sem regra" (payout R$0, travando o
-- fechamento):
--   1. Mojibake não reparado: o valor veio "AÈreo" em vez de "Aéreo". O detector do ETL
--      (encoding.ts) só dispara com letra minúscula antes do acento corrompido, então
--      palavra iniciada em maiúscula ("Aéreo") passa batido. A migration 0017 não pegou
--      esses porque só tratava campos vazios.
--   2. Campo vazio, com o meio só no texto da "Explicação do valor" ("troca de drop aérea").
--
-- Esta migration normaliza para o valor canônico usando o próprio campo (accent/encoding-
-- insensitive via immutable_unaccent) e, como fallback, a explicacao_valor. O ETL passou a
-- fazer o mesmo na ingestão (src/lib/etl/normalizer.ts — deriveSubterraneoAereo). Supera a
-- 0017 (também cobre os vazios-deriváveis); é seguro rodar após ela.
--
-- FORMA DE EXECUÇÃO: SQL Editor do Supabase (autocommit, statement a statement). NÃO usa
-- BEGIN/COMMIT. Idempotente: o WHERE só toca linhas que ainda não estão canônicas.
--
-- IMPORTANTE: após aplicar, rodar "Recalcular pendentes" em /pagamentos.

-- ============ Contagem ANTES ============
SELECT 'ANTES nao-canonico-derivavel' AS etapa, count(*) AS linhas
FROM service_visits
WHERE subterraneo_aereo IS DISTINCT FROM 'Aéreo'
  AND subterraneo_aereo IS DISTINCT FROM 'Subterrâneo'
  AND (
    public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%subterr%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%subterr%'
  );

-- ============ Canonicalização ============
UPDATE service_visits
SET subterraneo_aereo = CASE
  WHEN public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%aere%' THEN 'Aéreo'
  WHEN public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%subterr%' THEN 'Subterrâneo'
  WHEN public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%aere%' THEN 'Aéreo'
  WHEN public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%subterr%' THEN 'Subterrâneo'
  ELSE subterraneo_aereo
END
WHERE subterraneo_aereo IS DISTINCT FROM 'Aéreo'
  AND subterraneo_aereo IS DISTINCT FROM 'Subterrâneo'
  AND (
    public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%subterr%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%subterr%'
  );

-- ============ Contagem DEPOIS (deve ser 0) ============
SELECT 'DEPOIS nao-canonico-derivavel' AS etapa, count(*) AS linhas
FROM service_visits
WHERE subterraneo_aereo IS DISTINCT FROM 'Aéreo'
  AND subterraneo_aereo IS DISTINCT FROM 'Subterrâneo'
  AND (
    public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(subterraneo_aereo, ''))) LIKE '%subterr%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%aere%'
    OR public.immutable_unaccent(lower(coalesce(explicacao_valor, ''))) LIKE '%subterr%'
  );

-- ============ Diagnóstico: sucesso ainda sem meio (revisão manual / possível gap de regra) ==
SELECT 'RESIDUAL sucesso sem meio' AS etapa, count(*) AS linhas
FROM service_visits
WHERE (subterraneo_aereo IS NULL OR btrim(subterraneo_aereo) = '')
  AND lower(btrim(sucesso)) LIKE 'sim%';
