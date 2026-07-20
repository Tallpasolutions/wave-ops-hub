-- =============================================================================
-- 0021 — Preenche technicians.codigo_unetvale (mapa Unetvale, tenant Wave)
--
-- O coletor de IQI (ADR-012) casa cada técnico pelo `codigo_unetvale` = id do
-- técnico na Unetvale. Mapa coletado em 19/07/2026 (abas do Indicador IQI).
--
-- Match tolerante por nome (trim + lower + unaccent). Só atualiza quem casar;
-- nomes que não baterem ficam NULL e aparecem no SELECT de controle no fim
-- (ajustar o nome no mapa OU preencher manualmente). Idempotente.
-- Aplicar via Supabase SQL Editor.
-- =============================================================================

WITH mapa(nome, codigo) AS (
  VALUES
    ('Carlos Henrique Subtil Rodrigues', '540'),
    ('Lucas Luiz da Silva Rolla',        '572'),
    ('Daniel Orlando Soares',            '573'),
    ('Marcelo Cesar Vieira',             '579'),
    ('Douglas Ribeiro',                  '580'),
    ('Eduardo Ribeiro de Souza',         '581'),
    ('Anderson de Jesus de Oliveira',    '582'),
    ('Jeferson Luiz da Silva Fagundes',  '613'),
    ('Yuri Luz da Rosa',                 '528'),
    ('Joao Revair Dill',                 '614'),
    ('Caua de Oliveira Souza',           '625'),
    ('Cleiton Gabriel Sales de Oliveira','521'),
    ('Luam Carlos de Oliveira',          '559'),
    ('Ueliton Patriqui Nicoletti',       '522'),
    ('Alan Francisco de Lima Costa',     '701')
)
UPDATE technicians t
SET codigo_unetvale = m.codigo
FROM mapa m
WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'wave')
  AND lower(immutable_unaccent(t.nome_completo)) = lower(immutable_unaccent(m.nome));

-- Controle: nomes do mapa que NÃO casaram com nenhum técnico (esperado: 0 linhas).
WITH mapa(nome, codigo) AS (
  VALUES
    ('Carlos Henrique Subtil Rodrigues', '540'),
    ('Lucas Luiz da Silva Rolla',        '572'),
    ('Daniel Orlando Soares',            '573'),
    ('Marcelo Cesar Vieira',             '579'),
    ('Douglas Ribeiro',                  '580'),
    ('Eduardo Ribeiro de Souza',         '581'),
    ('Anderson de Jesus de Oliveira',    '582'),
    ('Jeferson Luiz da Silva Fagundes',  '613'),
    ('Yuri Luz da Rosa',                 '528'),
    ('Joao Revair Dill',                 '614'),
    ('Caua de Oliveira Souza',           '625'),
    ('Cleiton Gabriel Sales de Oliveira','521'),
    ('Luam Carlos de Oliveira',          '559'),
    ('Ueliton Patriqui Nicoletti',       '522'),
    ('Alan Francisco de Lima Costa',     '701')
)
SELECT m.nome AS nao_casou, m.codigo
FROM mapa m
WHERE NOT EXISTS (
  SELECT 1 FROM technicians t
  WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'wave')
    AND lower(immutable_unaccent(t.nome_completo)) = lower(immutable_unaccent(m.nome))
);
