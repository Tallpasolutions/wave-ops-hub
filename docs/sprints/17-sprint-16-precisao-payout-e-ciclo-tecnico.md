# Sprint 16 — Precisão do payout e ciclo de conferência do técnico

**Período:** 2026-07-20 a 2026-07-23
**Status:** ✅ **Concluída** — tudo mergeado em `main` (PRs #11 a #33) e em produção
**Origem:** Fechamento de julho/2026. Duas frentes que apareceram juntas: (a) o valor gerado
divergia da planilha conferida da Wave em vários casos, e (b) o técnico não tinha como conferir
nem discordar do próprio pagamento antes dele ser aprovado.
**Regras de execução:** [`regras-de-execucao.md`](./regras-de-execucao.md)

> Documento escrito em 24/07/2026, reconstruindo a sprint a partir dos PRs mergeados, das
> migrations aplicadas e dos ADRs 013 a 017. As entregas são anteriores ao documento — ele
> registra o que foi feito, não um plano a executar.

---

## Frente A — Precisão do valor do payout

O motor de LPU sozinho não descrevia o repasse real: a **finalidade da Unetvale é ambígua** em
vários serviços, e o que distingue está na coluna Z (`explicacao_valor`) ou na própria receita
recebida. Três decisões novas, todas **antes** do motor de LPU no cálculo (ver a
[ordem de precedência](../domain/03-payout.md#ordem-de-precedência-do-cálculo)):

| Item | Decisão | Artefatos |
|---|---|---|
| **Homologação** | Repasse fixo indexado pelo valor da Unetvale (64,46 → 35; 128,92 → 70; 142,23 → 79), com mapa mantido pelo gestor em `/homologacao`. Precede a LPU porque a finalidade é "Instalação - Fibra" e casaria instalação real (120/135) | [ADR-015](../architecture/ADR-015-homologacao-repasse.md), migration `0025` |
| **Ponto adicional** | `(+73 * N ponto(s) adicional(is))` na coluna Z soma **R$ 36 por ponto** sobre o valor-base (LPU, cabeamento, Venda Produto Externo). Homologação não passa por aqui — o mapa já traz o valor com ponto | [ADR-016](../architecture/ADR-016-ajustes-coluna-z.md), migration `0026` |
| **Unetvale 29,30 e Venda Produto Externo** | Receita de R$ 29,30 (roteador agregado) não paga o técnico; "Venda Produto Externo" tem o serviço real na coluna Z, não na finalidade | ADR-016 |

**LPU por técnico** ([ADR-014](../architecture/ADR-014-lpu-por-tecnico.md), migration `0023`):
a Wave passou a ter a tabela alternativa "SEM AUXILIAR", válida só para técnicos escolhidos pelo
gestor. A LPU aplicável passa a ser resolvida **por técnico** antes do match de regras.

**Exclusão de "Infra Genérico"** ([ADR-008](../architecture/ADR-008-exclusao-finalidades-infra.md),
migration `0028`): a lista de finalidades de infra tinha "Genérico" sem o prefixo, mas o dado da
Unetvale chega como "Infra Genérico" e o match é exato — OSs de infra passavam pelo filtro e
apareciam no fechamento como `no_rule_match`.

## Frente B — Ciclo de conferência e contestação do técnico

Fluxo completo em [ADR-013](../architecture/ADR-013-aprovacao-contestacao-tecnico.md) e no
[domínio de payout](../domain/03-payout.md#conferência-do-técnico-adr-013). Entregue em três
etapas, nesta ordem:

1. **Conferência no fechamento** (migration `0022`): "Solicitar aprovação" cria a revisão de cada
   técnico e o notifica; o técnico aprova o período ou contesta OSs em `/aprovacoes`; a Wave vê o
   status por técnico e resolve as contestações; **aprovar pagamento fica bloqueado** enquanto
   houver contestação aberta.
2. **Contestação contínua**: o técnico passou a poder contestar a qualquer momento, direto de
   `/visitas`, sem depender da janela de fechamento. Exigiu incluir `contestado` no conjunto
   **travado** do recálculo — sem isso um re-upload apagaria o status com a contestação ainda
   aberta.
3. **Ajuste de valor na resolução** (migration `0029`): a Wave resolve informando, opcionalmente,
   um novo valor. Vira `override` (travado, auditado) e o técnico recebe a notificação com a
   pontuação **antes → depois**, em `pts`.

**Notificações** ([ADR-017](../architecture/ADR-017-notificacoes-realtime.md), migration `0027`):
o ciclo acima só funciona se o aviso chega. Inserts cross-user passaram a usar o service role
(`src/lib/notifications/notify.ts`, resolvendo `users.id` a partir de `technician_id`), o
`tallpa_owner` entrou na lista de destinatários e a sineta passou a atualizar **em tempo real** via
Supabase Realtime — com `realtime.setAuth(token)` antes do `subscribe()`, sem o qual a RLS não
entrega os eventos e nada aparece, silenciosamente.

## Frente C — Correções de ETL, uploads e visibilidade

| Correção | O que era |
|---|---|
| Match de técnico com prefixo | Técnicos cadastrados **com** "INFRA WAVE - " no `nome_completo` não casavam; o matcher passou a remover o prefixo dos dois lados, e o vínculo ficou resiliente a duplicatas nulas |
| Dedup com paginação | A carga de visitas existentes na deduplicação não paginava e batia no corte de 1000 do PostgREST → `duplicate key` |
| Re-upload de planilha já ingerida | Virava erro; passou a ser contabilizado como **ignorada** |
| Reprocessar upload | Não limpava erros antigos e estourava timeout; ganhou também feedback de carregamento nos botões |
| Vincular técnico | Estourava timeout e deixava payout travado |
| Perfil do técnico | Mostrava só parte das visitas do mês e não exibia valor por visita |
| Drill-down "Deixado na mesa" | O card do perfil do técnico não tinha detalhe; agora `/equipe/tecnicos/[id]/deixado-na-mesa` lista as visitas que compõem o valor, com motivo |

---

## Migrations desta sprint

`0022` (aprovação/contestação) · `0023` (LPU por técnico) · `0024` (fix `codigo_unetvale` com
prefixo) · `0025` (homologação) · `0026` (limpeza de pontos "baked" em cabeamento) ·
`0027` (Realtime em `notifications`) · `0028` ("Infra Genérico" fora do escopo) ·
`0029` (valor antes/depois na contestação).

Todas idempotentes e aplicadas via Supabase SQL Editor, conforme CLAUDE.md §6.

## Pendências herdadas desta sprint

- **Recálculo pós-deploy** dos ADRs 015 e 016: os valores só ficam corretos nas visitas já
  ingeridas depois de recalcular o período. Confirmar por amostragem contra a planilha conferida
  da Wave antes de aprovar o fechamento de julho.
- **`config.feriados` vazia** (ADR-011): só domingos recebem o +15% até o gestor fornecer a lista.
- **Ajuda in-app desatualizada:** `/ajuda` não cobre Produtividade/IQI, Homologação, Cabeamento
  nem a conferência/contestação do técnico. Ver [tech-debt 016](../tech-debt.md).
