# Architecture Decision Records (ADRs)

Esta pasta contém todas as decisões arquiteturais tomadas no projeto. Cada ADR é numerado, datado e tem status (Proposto, Aceito, Rejeitado, Substituído).

**Regra:** antes de fazer qualquer mudança que conflite com um ADR, propor um novo ADR substituindo/atualizando o anterior.

## Lista

| Número | Título | Status |
|---|---|---|
| [ADR-001](./ADR-001-stack.md) | Stack Tecnológica | Aceito |
| [ADR-002](./ADR-002-multi-tenant.md) | Arquitetura Multi-Tenant | Aceito |
| [ADR-003](./ADR-003-os-visit-modeling.md) | Modelagem de OSs e Visitas | Aceito |
| [ADR-004](./ADR-004-lpu-rule-engine.md) | Motor de Regras LPU | Aceito |
| [ADR-005](./ADR-005-auth.md) | Autenticação e Autorização | Aceito |
| [ADR-006](./ADR-006-etl.md) | Estratégia de Ingestão (ETL) | Aceito |
| [ADR-007](./ADR-007-payouts-fechamento.md) | Arquitetura de Payouts e Fechamento Mensal | Aceito |
| [ADR-008](./ADR-008-exclusao-finalidades-infra.md) | Exclusão de finalidades de infraestrutura | Aceito |
| [ADR-009](./ADR-009-cabeamento-classificacao.md) | Payout de Cabeamento/Condomínio por classificação do gestor | Aceito |
| [ADR-010](./ADR-010-dashboard-drilldown.md) | Drill-down interativo do dashboard por filtros combináveis na URL | Aceito |
| [ADR-011](./ADR-011-acrescimo-domingo-feriado.md) | Acréscimo de 15% em domingos e feriados no payout | Proposto |
| [ADR-012](./ADR-012-iqi-ingestao-scraping.md) | Ingestão do Indicador IQI via scraping do Unetvale | Proposto |
| [ADR-013](./ADR-013-aprovacao-contestacao-tecnico.md) | Aprovação/contestação de payouts pelo técnico | Aceito |
| [ADR-014](./ADR-014-lpu-por-tecnico.md) | LPU por técnico (tabela alternativa) | Aceito |

## Template para novos ADRs

```markdown
# ADR-NNN — Título

**Status:** Proposto | Aceito | Rejeitado | Substituído por ADR-XXX
**Data:** YYYY-MM-DD
**Decisores:** Nome(s)

## Contexto
O que motiva esta decisão? Qual o problema?

## Decisão
O que foi decidido?

## Considerados e rejeitados
Outras opções avaliadas e por que não foram escolhidas.

## Consequências
Positivas e negativas/trade-offs aceitos.
```
