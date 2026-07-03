-- 0012 — Reparo de mojibake Latin-1→Mac Roman nos dados de planilha
--
-- As planilhas da Unetvale chegam com bytes Latin-1/CP1252 decodificados como Mac Roman
-- ("Instalação" → "InstalaÁ„o", "não" → "n„o", "Condomínio" → "CondomÌnio").
-- Diagnóstico provado contra o corpus do QA de 02/07/2026 — ver
-- docs/sprints/13-sprint-12-dados-confiaveis.md, Fase A. O ETL agora repara na ingestão
-- (src/lib/etl/encoding.ts); esta migration repara o que já foi gravado.
--
-- FORMA DE EXECUÇÃO: o SQL Editor do Supabase executa statement a statement (autocommit),
-- então este script NÃO usa BEGIN/COMMIT nem objetos temporários. Todos os UPDATEs são
-- idempotentes (guardados por has_mojibake_0012) — é seguro reexecutar o script inteiro
-- quantas vezes for preciso, inclusive após uma execução parcial.
--
-- IMPORTANTE: após aplicar, rodar "Recalcular pendentes" em /pagamentos — o match da
-- LPU ativa depende das strings de finalidade reparadas.

CREATE OR REPLACE FUNCTION public.repair_macroman_0012(v TEXT) RETURNS TEXT AS $$
  SELECT translate(
    v,
    U&'\2020\00B0\00A7\2022\00B6\00DF\00AE\2122\00B4\00A8\2260\00C6\00D8\221E\2264\2265\00A5\2202\2211\220F\03C0\222B\00AA\00BA\03A9\00E6\00F8\00BF\00A1\00AC\221A\0192\2248\2206\00AB\00BB\2026\00A0\00C0\00C3\00D5\0152\0153\2013\2014\201C\201D\2018\2019\00F7\25CA\00FF\0178\2044\20AC\2039\203A\FB01\FB02\2021\00B7\201A\201E\2030\00C2\00CA\00C1\00CB\00C8\00CD\00CE\00CF\00CC\00D3\00D4\F8FF\00D2\00DA\00DB\00D9\0131\02C6\02DC\00AF\02D8\02D9\02DA\00B8\02DD\02DB\02C7',
    U&'\00A0\00A1\00A4\00A5\00A6\00A7\00A8\00AA\00AB\00AC\00AD\00AE\00AF\00B0\00B2\00B3\00B4\00B6\00B7\00B8\00B9\00BA\00BB\00BC\00BD\00BE\00BF\00C0\00C1\00C2\00C3\00C4\00C5\00C6\00C7\00C8\00C9\00CA\00CB\00CC\00CD\00CE\00CF\00D0\00D1\00D2\00D3\00D4\00D5\00D6\00D7\00D8\00D9\00DA\00DB\00DC\00DD\00DE\00DF\00E0\00E1\00E2\00E3\00E4\00E5\00E6\00E7\00E8\00E9\00EA\00EB\00EC\00ED\00EE\00EF\00F0\00F1\00F2\00F3\00F4\00F5\00F6\00F7\00F8\00F9\00FA\00FB\00FC\00FD\00FE\00FF'
  )
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.has_mojibake_0012(v TEXT) RETURNS BOOLEAN AS $$
  SELECT v ~ U&'[\201E\201A\00B7]|[a-z\00E7\00E3\00F5\00E1\00E9\00ED\00F3\00FA\00E2\00EA\00F4][\00C0\00C1\00C2\00C3\00C4\00C8\00C9\00CA\00CB\00CC\00CD\00CE\00CF\00D2\00D3\00D4\00D5\00D6\00D9\00DA\00DB\00DC]'
$$ LANGUAGE sql IMMUTABLE;

-- ============ Contagem ANTES (colar o resultado no doc da sprint — R2.4) ============
SELECT 'ANTES service_visits' AS etapa, count(*) AS linhas_com_mojibake
FROM service_visits
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(sucesso,'') || coalesce(tecnico_raw,'')
      || coalesce(cidade,'') || coalesce(motivo_troca,'') || coalesce(explicacao_valor,'')
      || coalesce(faixa_drop,'') || coalesce(subterraneo_aereo,''))
UNION ALL
SELECT 'ANTES reasons', count(*) FROM reasons
WHERE public.has_mojibake_0012(motivo_original || motivo_normalizado)
UNION ALL
SELECT 'ANTES service_orders', count(*) FROM service_orders
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(cidade,''));

-- ============ service_visits: colunas de texto vindas da planilha ============
UPDATE service_visits SET
  finalidade        = public.repair_macroman_0012(finalidade),
  sucesso           = public.repair_macroman_0012(sucesso),
  tecnico_raw       = public.repair_macroman_0012(tecnico_raw),
  cidade            = public.repair_macroman_0012(cidade),
  motivo_troca      = public.repair_macroman_0012(motivo_troca),
  explicacao_valor  = public.repair_macroman_0012(explicacao_valor),
  faixa_drop        = public.repair_macroman_0012(faixa_drop),
  subterraneo_aereo = public.repair_macroman_0012(subterraneo_aereo)
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(sucesso,'') || coalesce(tecnico_raw,'')
      || coalesce(cidade,'') || coalesce(motivo_troca,'') || coalesce(explicacao_valor,'')
      || coalesce(faixa_drop,'') || coalesce(subterraneo_aereo,''));

-- ============ reasons: de-dup antes do reparo ============
-- reasons tem UNIQUE (tenant_id, motivo_original): se já existir a versão LIMPA de um
-- motivo mojibake, o reparo colidiria. Reapontar visitas e payouts para o motivo limpo,
-- depois apagar o duplicado corrompido. (Joins inline — sem tabela temporária.)
UPDATE service_visits sv SET reason_id = r_clean.id
FROM reasons r_moji
JOIN reasons r_clean
  ON r_clean.tenant_id = r_moji.tenant_id
 AND r_clean.motivo_original = public.repair_macroman_0012(r_moji.motivo_original)
 AND r_clean.id <> r_moji.id
WHERE public.has_mojibake_0012(r_moji.motivo_original)
  AND sv.reason_id = r_moji.id;

UPDATE payouts p SET reason_id = r_clean.id
FROM reasons r_moji
JOIN reasons r_clean
  ON r_clean.tenant_id = r_moji.tenant_id
 AND r_clean.motivo_original = public.repair_macroman_0012(r_moji.motivo_original)
 AND r_clean.id <> r_moji.id
WHERE public.has_mojibake_0012(r_moji.motivo_original)
  AND p.reason_id = r_moji.id;

DELETE FROM reasons r_moji
USING reasons r_clean
WHERE r_clean.tenant_id = r_moji.tenant_id
  AND r_clean.motivo_original = public.repair_macroman_0012(r_moji.motivo_original)
  AND r_clean.id <> r_moji.id
  AND public.has_mojibake_0012(r_moji.motivo_original);

-- reasons: repara o original e RE-DERIVA o normalizado (o normalizado antigo foi
-- lowercased sobre o mojibake, ex.: "EndereÁo" → "endereáo", e não repara sozinho)
UPDATE reasons SET
  motivo_original    = public.repair_macroman_0012(motivo_original),
  motivo_normalizado = lower(public.repair_macroman_0012(motivo_original))
WHERE public.has_mojibake_0012(motivo_original || motivo_normalizado);

-- ============ service_orders ============
UPDATE service_orders SET
  finalidade = public.repair_macroman_0012(finalidade),
  cidade     = public.repair_macroman_0012(cidade)
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(cidade,''));

-- ============ technicians (cadastrados via app normalmente são limpos; defensivo) ============
UPDATE technicians SET
  nome_completo   = public.repair_macroman_0012(nome_completo),
  codigo_unetvale = public.repair_macroman_0012(codigo_unetvale)
WHERE public.has_mojibake_0012(coalesce(nome_completo,'') || coalesce(codigo_unetvale,''));

-- ============ Diagnóstico (sem update): regras LPU com mojibake nas conditions ============
-- A LPU ativa ("LPU Wave 2026 — Revisada", seed) tem strings limpas; regras
-- antigas/rascunho podem ter mojibake mas não participam do cálculo. Se esta query
-- retornar regra de LPU ATIVA, corrigir manualmente pela UI antes de recalcular.
SELECT 'lpu_rules com mojibake' AS etapa, r.id, l.nome AS lpu, l.ativa
FROM lpu_rules r JOIN lpus l ON l.id = r.lpu_id
WHERE public.has_mojibake_0012(r.conditions::text);

-- ============ Contagem DEPOIS (esperado: 0 em todas) ============
SELECT 'DEPOIS service_visits' AS etapa, count(*) AS linhas_com_mojibake
FROM service_visits
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(sucesso,'') || coalesce(tecnico_raw,'')
      || coalesce(cidade,'') || coalesce(motivo_troca,'') || coalesce(explicacao_valor,'')
      || coalesce(faixa_drop,'') || coalesce(subterraneo_aereo,''))
UNION ALL
SELECT 'DEPOIS reasons', count(*) FROM reasons
WHERE public.has_mojibake_0012(motivo_original || motivo_normalizado)
UNION ALL
SELECT 'DEPOIS service_orders', count(*) FROM service_orders
WHERE public.has_mojibake_0012(coalesce(finalidade,'') || coalesce(cidade,''));

-- Limpeza das funções auxiliares
DROP FUNCTION IF EXISTS public.repair_macroman_0012(TEXT);
DROP FUNCTION IF EXISTS public.has_mojibake_0012(TEXT);
