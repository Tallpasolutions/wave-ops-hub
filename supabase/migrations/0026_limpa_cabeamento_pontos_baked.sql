-- =============================================================================
-- 0026 — Limpeza das classificações de Cabeamento com ponto "embutido" (ADR-016)
--
-- Antes, o modificador de pontos ("(+73 * N ponto(s) adicional(is))") fazia parte
-- da chave de classificação e o valor vinha embutido, com incremento inconsistente
-- (ex.: "Cabeamento (+73 * 1 ponto...)" = 76, quando o certo é base 44 + 36 = 80).
--
-- A partir do ADR-016 o ponto adicional é um acréscimo uniforme (+R$ 36) calculado
-- no motor (ver src/lib/payouts/calculate.ts), e normalizeExplicacao remove o
-- modificador — então as visitas com ponto passam a casar a chave-BASE
-- ("Cabeamento", "Cabeamento agregado") e recebem base + 36×N.
--
-- Estas linhas com o ponto na chave ficaram órfãs (nunca mais são consultadas).
-- Removê-las evita confundir o gestor em /cabeamento. Idempotente.
--
-- Aplicar manualmente via Supabase SQL Editor. Ver docs/architecture/ADR-016.
-- =============================================================================

DELETE FROM cabeamento_classifications
WHERE explicacao_key ~* 'ponto\(s\)? adicional';

-- Controle: nenhuma chave com "ponto adicional" deve restar (esperado: 0)
SELECT 'cabeamento_classifications com ponto na chave' AS etapa, count(*) AS total
FROM cabeamento_classifications
WHERE explicacao_key ~* 'ponto\(s\)? adicional';
