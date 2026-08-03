-- =============================================================================
-- 0040 — Remove as 3 visitas duplicadas por reemissão da Unetvale (ADR-003)
--
-- Sem bloco DO $$ (o SQL Editor trunca — ver 0036). Idempotente: rodar duas vezes não faz nada
-- na segunda. O `payouts` tem FK `ON DELETE CASCADE` sobre `service_visits`, então o payout
-- duplicado sai junto — por isso as três conferências no fim.
--
-- ── PROBLEMA: OS 572894 aparecia com 3 visitas e receita R$ 634,50 ────────────────────────
-- A última planilha (lista-os-julho-2026-completa.xlsx, 03/08) traz só 2 linhas para essa OS.
-- A terceira é um fantasma de ingestão.
--
-- ── O QUE ACONTECEU ──────────────────────────────────────────────────────────────────────
-- Quando a Unetvale **corrige o pagamento** de uma OS já entregue, ela reemite a linha com o
-- valor novo — e carimba na coluna de data de execução o **horário do ajuste**, não o da
-- execução. Na OS 572894 a linha voltou como 15/07 **23:48** (receita 412,26) no lugar de
-- 15/07 **20:24** (receita 206,26), e a própria observação da linha nova preserva o horário
-- verdadeiro: "Acréscimo de pagamento pelo atendimento fora do horário de expediente [...]
-- 15/07/2026 20:24".
--
-- A chave natural da visita é `UNIQUE (tenant_id, os_num, data_execucao, tecnico_id)` — com
-- `data_execucao` **timestamp**. Mudou o horário, mudou a chave: o ingestor tratou como visita
-- NOVA em vez de atualizar a existente. Resultado: duas visitas para a mesma execução, duas
-- receitas somadas e **dois payouts**.
--
-- ── AS TRÊS OCORRÊNCIAS (varredura completa da base em 03/08/2026) ────────────────────────
-- Mesma assinatura nas três: linha antiga com o horário real, linha nova (upload de 03/08) com
-- horário 23:4x, mesma finalidade, mesma coluna Z, mesmo drop/conectores, e observação na linha
-- nova explicando o acréscimo. Todas com payout `pending_review`, sem ajuste manual, sem
-- fechamento — nenhuma travada.
--
--   OS 572894 · Douglas Ribeiro · 15/07 20:24 (R$ 206,26) → reemitida 23:48 (R$ 412,26)
--              obs: "Acréscimo de pagamento pelo atendimento fora do horário de expediente"
--   OS 569727 · Eduardo Ribeiro · 01/07 16:54 (R$ 64,46)  → reemitida 23:44 (R$ 128,92)
--              obs: "pagamento de 1 internas pelo apoio do técnico Eduardo em levar..."
--   OS 568969 · Eduardo Ribeiro · 01/07 11:24 (R$ 64,46)  → reemitida 23:43 (R$ 128,92)
--              obs: "Alinhado pagamento com Acréscimo"
--
-- Fica **a linha nova** (valor correto) e sai a antiga. As três reemissões caem no mesmo dia da
-- original, então período, dia da semana e acréscimo de domingo/feriado não mudam.
--
-- Efeito: −R$ 160,00 em payout duplicado (100 + 30 + 30) e −R$ 335,18 de receita fantasma.
--
-- ── O QUE NÃO É ESTE CASO (não mexer) ─────────────────────────────────────────────────────
-- A OS 568170 (Daniel Orlando Soares, 24/06) também tem duas visitas com sucesso no mesmo dia
-- — 10:03 e 10:51 — mas **as duas vieram do mesmo upload**, e a de 10:03 traz a observação
-- "Pagamento zerado devido o técnico [...] ter realizado o fechamento desta OS" com receita
-- R$ 0,00. São duas execuções reais, e o ADR-020 já resolve a zerada pagando R$ 0. É a prova de
-- que **duas visitas com sucesso no mesmo dia pelo mesmo técnico são legítimas** — por isso a
-- chave natural NÃO pode passar a ser por dia. Ver o adendo do ADR-003.
-- =============================================================================

DELETE FROM service_visits v
USING payouts p
WHERE p.visit_id = v.id
  AND v.os_num IN (572894, 569727, 568969)
  AND v.data_execucao IN (
        TIMESTAMPTZ '2026-07-15 20:24:00+00',
        TIMESTAMPTZ '2026-07-01 16:54:00+00',
        TIMESTAMPTZ '2026-07-01 11:24:00+00'
      )
  -- trava de segurança: só remove payout intocado. Aprovado, pago, contestado, com ajuste
  -- manual ou já dentro de um fechamento fica onde está, e a conferência 1 vai denunciar.
  AND p.status = 'pending_review'
  AND p.override_by IS NULL
  AND p.closing_id IS NULL
  AND p.approved_at IS NULL
  AND p.paid_at IS NULL;

-- ── Conferência 1: as três OSs ficaram com as linhas certas ───────────────────────────────
-- Esperado: 572894 com 2 visitas (15,98 improdutiva + 412,26) · 569727 com 1 (128,92) ·
--           568969 com 2 (128,92 + 15,98 da improdutiva de 24/07).
-- Se alguma linha antiga ainda aparecer, o payout dela estava travado — conferir antes de forçar.
SELECT sv.os_num, sv.data_execucao, sv.sucesso, sv.valor_recebido_unetvale AS receita,
       p.valor_calculado, p.status
FROM service_visits sv
LEFT JOIN payouts p ON p.visit_id = sv.id
WHERE sv.os_num IN (572894, 569727, 568969)
ORDER BY sv.os_num, sv.data_execucao;

-- ── Conferência 2: receita total por OS ───────────────────────────────────────────────────
-- Esperado: 572894 = R$ 428,24 (era 634,50) · 569727 = R$ 128,92 · 568969 = R$ 144,90.
SELECT os_num, count(*) AS visitas, sum(valor_recebido_unetvale) AS receita_total
FROM service_visits
WHERE os_num IN (572894, 569727, 568969)
GROUP BY os_num ORDER BY os_num;

-- ── Conferência 3: varredura — sobrou alguma reemissão na base? ───────────────────────────
-- Lista todo par (OS, técnico, dia) com 2+ visitas de SUCESSO. Esperado depois desta migration:
-- só a OS 568170, que é legítima (as duas linhas do mesmo upload, uma zerada pela Unetvale).
-- Qualquer linha nova aqui num próximo upload é candidata a reemissão — conferir a observação.
SELECT sv.os_num, sv.tecnico_id, sv.data_execucao::date AS dia, count(*) AS visitas_com_sucesso,
       array_agg(sv.data_execucao::time ORDER BY sv.data_execucao) AS horarios,
       array_agg(sv.valor_recebido_unetvale ORDER BY sv.data_execucao) AS receitas
FROM service_visits sv
WHERE lower(btrim(sv.sucesso)) LIKE 'sim%'
GROUP BY sv.os_num, sv.tecnico_id, sv.data_execucao::date
HAVING count(*) > 1
ORDER BY sv.os_num;
