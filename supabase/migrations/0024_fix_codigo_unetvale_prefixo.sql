-- =============================================================================
-- 0024 — Corrige technicians.codigo_unetvale para técnicos com prefixo no nome
--
-- A 0021 casava por nome_completo SEM remover o prefixo de organização
-- ("INFRA WAVE - ", "WAVE - "). Como parte dos técnicos foi cadastrada COM o
-- prefixo (ex: "INFRA WAVE - Jeferson Luiz da Silva Fagundes"), esses não casaram
-- e ficaram com codigo_unetvale errado (login/nome no lugar do id numérico) — o
-- coletor de IQI então batia em 401/404/[] para eles.
--
-- Aqui o match remove o prefixo dos dois lados antes de comparar (mesma regra do
-- matcher de ETL em src/lib/etl/matchers.ts). Idempotente. Aplicar via Supabase
-- SQL Editor.
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
  AND lower(immutable_unaccent(
        regexp_replace(t.nome_completo, '^\s*(INFRA\s+)?WAVE\s*-\s*', '', 'i')
      )) = lower(immutable_unaccent(m.nome))
  AND t.codigo_unetvale IS DISTINCT FROM m.codigo;

-- Controle: técnicos ativos que continuam sem um código numérico válido (esperado:
-- apenas os que ainda não têm mapeamento conhecido — ex: Juliano, Jean, Edson).
SELECT t.nome_completo, t.codigo_unetvale
FROM technicians t
WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'wave')
  AND t.ativo = true
  AND (t.codigo_unetvale IS NULL OR t.codigo_unetvale !~ '^[0-9]+$')
ORDER BY t.nome_completo;
