# ADR-013 — Aprovação/contestação de payouts pelo técnico

**Status:** Aceito (implementado)
**Data:** 2026-07-20
**Decisores:** Jhoni Cleyton (Tallpa)
**Origem:** Demanda do gestor (20/07) — o técnico deve conferir suas OSs antes do pagamento,
podendo aprovar ou contestar; contestação volta para a Wave por técnico, com notificações.
Corresponde ao item "Sprint 18 — Contestação Técnico" do roadmap.

## Contexto

O fluxo anterior era: Wave "Solicitar aprovação" → `aguardando_aprovacao` → **a própria Wave**
aprovava → pago. Não havia etapa de conferência do técnico. Também havia um bug latente: as
notificações de payout usavam `user_id = technician_id` (que não é `users.id`), então não
chegavam ao técnico.

## Decisão

Inserir a conferência do técnico entre "Solicitar aprovação" e a aprovação final da Wave,
**reaproveitando os estados de `monthly_closings`** (`aguardando_aprovacao` passa a significar
"aguardando conferência dos técnicos") e o status `contestado` que já existia em `payouts`.

### Modelo (migration 0022)
- `closing_technician_reviews (tenant, periodo, technician_id, status)` — status por técnico:
  `pendente` | `aprovado` | `contestado`.
- `payout_contestacoes (payout_id, technician_id, periodo, motivo, status, resposta_gestor…)` —
  uma contestação por payout; índice único parcial garante só **uma aberta** por payout.
- RLS igual a `service_visits` (tenant; técnico vê/mexe no próprio; supervisor vê a equipe;
  gestor tudo do tenant). Gravações do técnico usam o client autenticado (RLS aplicado).

### Fluxo
1. **Solicitar aprovação** (Wave): cria/reseta a revisão de cada técnico como `pendente` e o
   **notifica** (link `/aprovacoes`).
2. **Técnico** (`/aprovacoes`): confere as OSs do período; **contesta** OSs com motivo
   (payout → `contestado`, revisão → `contestado`, notifica a Wave) ou **aprova** o período
   (revisão → `aprovado`, notifica a Wave).
3. **Wave** vê no fechamento o status por técnico e as **contestações abertas**; **resolve** cada
   uma com uma resposta (payout volta a `pending`, revisão volta a `pendente`, notifica o técnico).
4. **Aprovar pagamento** (Wave): **bloqueado enquanto houver contestação aberta** no período.
   Aprovado → gera os PDFs (fluxo de export existente).

### Notificações
Cruzam usuários (técnico↔gestores), então os inserts em `notifications` usam o **service role**
(`src/lib/notifications/notify.ts`), resolvendo corretamente `users.id` a partir de
`technician_id` (corrige o bug do mapeamento). As gravações de domínio seguem pelo client
autenticado.

## Considerados e rejeitados
- **Novos estados em `monthly_closings`** para "em revisão": desnecessário — `aguardando_aprovacao`
  já cobre; a granularidade por técnico fica em `closing_technician_reviews`.
- **Bloquear aprovação até todos os técnicos aprovarem**: muito rígido para v1 (técnico pode não
  responder). Bloqueia-se apenas em **contestação aberta**; revisões `pendente` geram alerta visual,
  não travam.

## Consequências / pendências
- Descoberta no app do técnico via **notificação + banner na home**; não foi adicionado item fixo
  na navegação inferior (já com 5 itens) — reavaliar se necessário.
- Valores são exibidos ao técnico em `/aprovacoes` mesmo com `show_money_on_technician_panel=false`
  (a contestação é sobre valores). Reavaliar se algum tenant exigir ocultar.
- Evoluções futuras: contestação com anexo/foto; histórico de contestações resolvidas na tela do
  técnico; painel de contestações fora do fechamento.

## Adendo (2026-07-22) — contestação contínua

O técnico passou a poder contestar **a qualquer momento**, direto da lista `/visitas` (não só na
janela de fechamento após "Solicitar aprovação"). Reaproveita a mesma action `contestarPayout` e
as notificações; a atualização de `closing_technician_reviews` é no-op quando ainda não há revisão
do período. A Wave vê/resolve em `/fechamento/[periodo]` — a linha de `monthly_closings` já existe
porque o recálculo (`ensureMonthlyClosings`) a cria quando há payouts no período.

Ajuste necessário: `contestado` entrou no conjunto **travado** do recálculo
(`recalculate-batch.ts`), ao lado de `approved`/`paid`/`override_by`. Sem isso, um re-upload
recalcularia o payout contestado e apagaria o status (a contestação em `payout_contestacoes`
continuaria aberta, gerando inconsistência). Ao resolver, a Wave volta o payout para `pending`
(destravado), que volta a reprocessar normalmente.

## Adendo (2026-07-23) — a Wave ajusta o valor ao resolver; o técnico vê antes → depois

Resolver a contestação só com um texto de resposta não fechava o ciclo: quando a Wave concordava
com o técnico, ainda era preciso ir a `/pagamentos/[id]/override` corrigir o valor à mão, em outra
tela, sem ligação com a contestação.

**Decisão:** o formulário de resolução (`/fechamento/[periodo]`) ganha um campo opcional de novo
valor, e a contestação passa a guardar o par antes/depois (`valor_anterior`, `valor_novo` —
migration 0029; `NULL` nas contestações anteriores a esta mudança).

- **Valor "antes"** = valor **efetivo** no momento da resolução (`valor_override ?? valor_calculado`),
  não o calculado bruto — é o que o técnico via.
- **Campo vazio, ou valor igual ao atual** → mantém o valor; grava `valor_anterior = valor_novo`.
- **Valor diferente** → aplica **override manual** (`valor_override`, `override_by`, `override_at`,
  `override_motivo` com a resposta), o que também **trava** o payout no recálculo — o ajuste
  combinado com o técnico não é desfeito por um re-upload posterior.
- Em ambos os casos o payout volta a `pending`, a revisão do técnico volta a `pendente` (ele
  confere de novo) e a notificação carrega o delta: "Pontuação: X → Y".
- O técnico vê a seta antes → depois em `/aprovacoes` e em `/visitas`, **em pontos** (`pts`),
  seguindo a convenção do painel do técnico. A seta só aparece quando os valores diferem
  (comparados arredondados).

**Consequência:** ajuste de valor por contestação é sempre um `override`, com autor, hora e motivo
— a trilha de auditoria do payout e a contestação contam a mesma história.
