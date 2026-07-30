-- =============================================================================
-- 0034 — Contestação resolvida SEM ajuste de valor passa a travar o recálculo (ADR-013)
--
-- PROBLEMA:
--   `resolverContestacao` só gravava `override_by` quando a Wave ALTERAVA o valor. Quando
--   analisava e MANTINHA o valor, o payout voltava para 'pending' sem nenhuma marca de decisão
--   manual — e o recálculo (recalculate-batch.ts) trava apenas approved/paid/contestado/
--   override_by. Resultado: um "Recalcular pendentes" posterior podia sobrescrever justamente
--   o valor que o gestor tinha acabado de confirmar ao técnico, desfazendo a conferência em
--   silêncio. Confirmar o valor é uma decisão do gestor tanto quanto mudá-lo.
--
--   Com a conferência da Wave em andamento e os técnicos contestando em tempo real, esse é o
--   caminho mais provável de perda de trabalho já feito.
--
-- CORREÇÃO:
--   O código passa a gravar `override_by` nos dois casos (ver fechamento/actions.ts). Esta
--   migration faz o mesmo para as contestações JÁ resolvidas sem ajuste, que hoje seguem
--   destravadas no banco.
--
-- `valor_override` NÃO é preenchido quando o valor não mudou: a trava é `override_by`, e um
-- override igual ao calculado esconderia a quebra do acréscimo de domingo/feriado na tela do
-- técnico (ADR-011) e exibiria uma linha "Override" redundante no detalhe do payout.
--
-- Não altera schema. FORMA DE EXECUÇÃO: SQL Editor do Supabase. Idempotente
-- (`override_by IS NULL` já é a guarda). Não precisa recalcular depois.
-- =============================================================================

UPDATE payouts p
SET override_by     = c.resolved_by,
    override_at     = c.resolved_at,
    override_motivo = COALESCE(
      p.override_motivo,
      'Valor mantido na resolução de contestação (backfill 0034): ' ||
        COALESCE(c.resposta_gestor, 'sem resposta registrada')
    )
FROM payout_contestacoes c
WHERE c.payout_id = p.id
  AND c.status = 'resolvida'
  AND c.resolved_by IS NOT NULL
  AND p.override_by IS NULL
  -- approved/paid já estão travados por status; não mexer em payout fechado.
  AND p.status NOT IN ('approved', 'paid');

-- ── Conferência: toda contestação resolvida tem de estar travada no recálculo ──────────────
-- Esperado: nenhuma linha com travado = false.
SELECT c.periodo,
       c.resolved_at::date            AS resolvida_em,
       sv.os_num,
       p.status,
       p.valor_calculado,
       p.valor_override,
       (p.status IN ('approved', 'paid') OR p.override_by IS NOT NULL) AS travado
FROM payout_contestacoes c
JOIN payouts p        ON p.id = c.payout_id
JOIN service_visits sv ON sv.id = p.visit_id
WHERE c.status = 'resolvida'
ORDER BY travado, c.resolved_at;
